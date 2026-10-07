import type { Core, WebViewerInstance } from "@pdftron/webviewer";
import { Alert, Badge, Button, Group, Text, Title } from "@mantine/core";
import {
  IconArrowLeft,
  IconDownload,
  IconSignature,
  IconX,
} from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { findAgreement, findUserByRole } from "../lib/data";
import {
  agreementStatus,
  formatDate,
  roleLabel,
  statusColor,
  statusLabel,
} from "../lib/format";
import {
  clearSignatures,
  saveSignature,
  useSignatures,
} from "../lib/signatures";
import { ROLES, type Role } from "../lib/types";
import { useWebViewer } from "../lib/useWebViewer";

type SignatureWidget = Core.Annotations.SignatureWidgetAnnotation;
type SignatureWidgets = Partial<Record<Role, SignatureWidget>>;
type ImportedSignature = {
  xfdf: string;
  annotations: Core.Annotations.Annotation[];
};

const INDICATOR_TEXT = "Sign here";

function setSignIndicator(
  instance: WebViewerInstance,
  widget: SignatureWidget | undefined,
  show: boolean,
) {
  if (!widget) return;
  const manager = instance.Core.annotationManager.getFormFieldCreationManager();
  if (manager.getShowIndicator(widget) === show) return;
  if (show) manager.setIndicatorText(widget, INDICATOR_TEXT);
  manager.setShowIndicator(widget, show);
}

/** Shows the indicator only while the user's own signature field is unsigned */
function updateSignIndicator(
  instance: WebViewerInstance,
  widget: SignatureWidget | undefined,
) {
  setSignIndicator(
    instance,
    widget,
    !!widget && !widget.getAssociatedSignatureAnnotation(),
  );
}

/**
 * Collects the PDF's signature fields per role and makes fields for roles other than the logged-in user's read-only.
 */
function setupSignatureWidgets(
  instance: WebViewerInstance,
  signatureFields: Record<Role, string>,
  myRole: Role,
): SignatureWidgets {
  const { Annotations, annotationManager } = instance.Core;
  const widgets: SignatureWidgets = {};
  for (const annot of annotationManager.getAnnotationsList()) {
    if (!(annot instanceof Annotations.SignatureWidgetAnnotation)) continue;
    const role = ROLES.find((r) => signatureFields[r] === annot.getFieldName());
    if (!role) continue;
    widgets[role] = annot;
    if (role === myRole) {
      updateSignIndicator(instance, annot);
    } else {
      annot.fieldFlags.set(Annotations.WidgetFlags.READ_ONLY, true);
      annot.refresh();
      setSignIndicator(instance, annot, false);
    }
  }
  annotationManager.drawAnnotationsFromList(Object.values(widgets));
  return widgets;
}

export function AgreementViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const agreement = findAgreement(id);
  const signatures = useSignatures(agreement?.id);
  const [widgets, setWidgets] = useState<SignatureWidgets | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const importedRef = useRef<Partial<Record<Role, ImportedSignature>>>({});
  const syncQueueRef = useRef(Promise.resolve());
  // fullAPI is required to flatten the signed PDF (flatten option of getFileData)
  const { viewerRef, instance } = useWebViewer({ fullAPI: true });

  const myRole = user!.role;
  const status = signatures ? agreementStatus(signatures) : null;
  const mySignature = signatures?.[myRole] ?? null;

  // Load the document and configure the signature fields
  useEffect(() => {
    if (!instance || !agreement) return;
    const { documentViewer, annotationManager, Tools } = instance.Core;

    // Disallow annotation tools other than signing
    instance.UI.setToolbarGroup(instance.UI.ToolbarGroup.VIEW);
    instance.UI.disableElements(["default-ribbon-group"]);
    // Disallow WebViewer's built-in download/save, which doesn't flatten and leaves empty signature fields under the signature images
    // (the only download is "Download signed PDF", which outputs a flattened PDF after both parties have signed)
    instance.UI.disableFeatures([instance.UI.Feature.Download]);
    instance.UI.disableElements(["downloadButton", "saveAsButton"]);
    annotationManager.setCurrentUser(user!.name);
    // Create signatures as standalone annotations rather than widget appearances so they can be saved as XFDF per role
    const signatureTool = documentViewer.getTool(
      Tools.ToolNames.SIGNATURE,
    ) as Core.Tools.SignatureCreateTool;
    signatureTool.setSigningMode(
      Tools.SignatureCreateTool.SigningModes.ANNOTATION,
    );
    // Guide the user to where they need to sign with indicators beside the page
    instance.UI.showFormFieldIndicators();
    // Remove field highlighting so that signed fields show only the signature image
    // (unsigned fields can still be identified by the "Sign here" button and indicator)
    annotationManager.getFieldManager().disableWidgetHighlighting();

    let loadedWidgets: SignatureWidgets = {};
    const onAnnotationsLoaded = () => {
      importedRef.current = {};
      loadedWidgets = setupSignatureWidgets(
        instance,
        agreement.signatureFields,
        myRole,
      );
      setWidgets(loadedWidgets);
    };
    // As a safeguard, remove any signatures added locally to other roles' signature fields
    const onAnnotationChanged = (
      annotations: Core.Annotations.Annotation[],
      action: string,
      info: { imported: boolean },
    ) => {
      // Update the indicator as signatures are added or removed (checked after the signature is associated with its widget)
      setTimeout(() => updateSignIndicator(instance, loadedWidgets[myRole]));
      if (action !== "add" || info.imported) return;
      for (const role of ROLES) {
        if (role === myRole) continue;
        const associated =
          loadedWidgets[role]?.getAssociatedSignatureAnnotation();
        if (associated && annotations.includes(associated)) {
          annotationManager.deleteAnnotation(associated, { force: true });
          setMessage(
            `You cannot sign the ${roleLabel[role].toLowerCase()}'s signature field`,
          );
        }
      }
    };
    documentViewer.addEventListener("annotationsLoaded", onAnnotationsLoaded, {
      once: true,
    });
    annotationManager.addEventListener(
      "annotationChanged",
      onAnnotationChanged,
    );
    instance.UI.loadDocument(agreement.file, {
      filename: `${agreement.title}.pdf`,
    });

    return () => {
      documentViewer.removeEventListener(
        "annotationsLoaded",
        onAnnotationsLoaded,
      );
      annotationManager.removeEventListener(
        "annotationChanged",
        onAnnotationChanged,
      );
    };
  }, [instance, agreement, myRole, user]);

  // Apply saved signatures to the PDF (signatures and resets in other tabs are reflected too)
  useEffect(() => {
    if (!instance || !widgets || !signatures) return;
    const { annotationManager } = instance.Core;

    const { WidgetFlags } = instance.Core.Annotations;

    const sync = async () => {
      for (const role of ROLES) {
        const widget = widgets[role];
        if (!widget) continue;
        const stored = signatures[role];
        const current = importedRef.current[role];
        if (current?.xfdf === stored?.xfdf) continue;

        // Read-only widgets can't change their signature association, so lift read-only while applying
        const readOnly = widget.fieldFlags.get(WidgetFlags.READ_ONLY);
        widget.fieldFlags.set(WidgetFlags.READ_ONLY, false);
        try {
          if (current) {
            // Deleting the associated signature annotation reverts the widget to its unsigned appearance
            annotationManager.deleteAnnotations(current.annotations, {
              imported: true,
              force: true,
            });
            delete importedRef.current[role];
          }
          if (stored) {
            // Imported signatures are automatically associated with the overlapping signature widget
            const annotations: Core.Annotations.Annotation[] =
              await annotationManager.importAnnotations(stored.xfdf);
            for (const annot of annotations) annot.ReadOnly = true;
            importedRef.current[role] = { xfdf: stored.xfdf, annotations };
          }
        } finally {
          widget.fieldFlags.set(WidgetFlags.READ_ONLY, readOnly);
          // Hide the form field for confirmed signatures so only the signature image shows (shown again if the signature is removed)
        }
      }
    };
    syncQueueRef.current = syncQueueRef.current
      .then(sync)
      .catch((e) => setMessage(`Failed to display signatures: ${e}`));
  }, [instance, widgets, signatures]);

  const confirmSignature = async () => {
    if (!instance || !agreement) return;
    const annot = widgets?.[myRole]?.getAssociatedSignatureAnnotation();
    if (!annot) {
      setMessage(
        `Click the ${roleLabel[myRole].toLowerCase()}'s signature field to sign`,
      );
      return;
    }
    const { annotationManager } = instance.Core;
    const xfdf = await annotationManager.exportAnnotations({
      annotationList: [annot],
      widgets: false,
      fields: false,
    });
    // Delete the hand-drawn signature and re-import the saved XFDF as read-only
    annotationManager.deleteAnnotation(annot, { force: true });
    saveSignature(agreement.id, myRole, xfdf);
    setMessage("Signature saved");
  };

  const downloadSignedPdf = async () => {
    if (!instance || !agreement) return;
    const { documentViewer, annotationManager } = instance.Core;
    const xfdfString = await annotationManager.exportAnnotations();
    const data = await documentViewer
      .getDocument()
      .getFileData({ xfdfString, flatten: true, downloadType: "pdf" });
    const url = URL.createObjectURL(
      new Blob([new Uint8Array(data)], { type: "application/pdf" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${agreement.title} (signed).pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!agreement) return <Alert color="red">Agreement not found</Alert>;

  return (
    <>
      <Group justify="space-between" mb="sm">
        <Group>
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate("/agreements")}
          >
            Back to list
          </Button>
          <Title order={4}>{agreement.title}</Title>
          {status && (
            <Badge color={statusColor[status]} variant="light">
              {statusLabel[status]}
            </Badge>
          )}
        </Group>
        <Group>
          {status === "signed" && (
            <Button
              variant="default"
              leftSection={<IconDownload size={16} />}
              onClick={downloadSignedPdf}
            >
              Download signed PDF
            </Button>
          )}
          {mySignature ? (
            <Button
              variant="light"
              color="red"
              leftSection={<IconX size={16} />}
              onClick={() => clearSignatures(agreement.id, [myRole])}
            >
              Revoke my signature
            </Button>
          ) : (
            <Button
              leftSection={<IconSignature size={16} />}
              disabled={!widgets}
              onClick={confirmSignature}
            >
              Confirm signature
            </Button>
          )}
        </Group>
      </Group>

      <Text size="xs" c="dimmed" mb="xs">
        {ROLES.map((role) => {
          const signature = signatures?.[role];
          const state = signature
            ? `Signed (${formatDate(signature.signedAt)})`
            : "Not signed";
          return `${roleLabel[role]}: ${findUserByRole(role)?.name ?? "-"} ${state}`;
        }).join(" / ")}
        {` / You can only sign the ${roleLabel[myRole].toLowerCase()}'s signature field`}
      </Text>
      {widgets && !widgets[myRole] && (
        <Alert mb="xs" color="red">
          Signature field for the {roleLabel[myRole].toLowerCase()} (
          {agreement.signatureFields[myRole]}) was not found in the PDF
        </Alert>
      )}
      {message && (
        <Alert
          mb="xs"
          color={message.startsWith("Failed") ? "red" : "blue"}
          withCloseButton
          onClose={() => setMessage(null)}
        >
          {message}
        </Alert>
      )}
      <div ref={viewerRef} style={{ flex: 1, minHeight: 0 }} />
    </>
  );
}
