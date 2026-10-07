# Multi-Signer PDF Signing Demo (React + Apryse WebViewer)

A demo in which a seller and a buyer each sign only their own signature field on a single PDF agreement.
There is no backend: users and agreements are stored as JSON, and signatures are saved in the browser's localStorage.

The core ideas:

1. **Based on the logged-in user's role, the viewer identifies which signature field is active for that user and makes every other signature field read-only.**
2. **Only the XFDF of the signature belonging to that role is extracted and saved, so each party's signature is stored independently.**

## Key point 1: role-based field activation

Each agreement maps roles to PDF signature field names (`src/data/agreements.json`):

```json
"signatureFields": {
  "seller": "formSignature_p1_1",
  "buyer": "formSignature_p1_2"
}
```

Once the document's annotations are loaded, `setupSignatureWidgets` in `src/pages/AgreementViewPage.tsx` walks through the signature widgets in the PDF and matches each one to a role by its field name:

```ts
for (const annot of annotationManager.getAnnotationsList()) {
  if (!(annot instanceof Annotations.SignatureWidgetAnnotation)) continue;
  const role = ROLES.find((r) => signatureFields[r] === annot.getFieldName());
  if (!role) continue;
  widgets[role] = annot;
  if (role === myRole) {
    // Active field: show the "Sign here" indicator while unsigned
    updateSignIndicator(instance, annot);
  } else {
    // Other roles' fields: read-only, no indicator
    annot.fieldFlags.set(Annotations.WidgetFlags.READ_ONLY, true);
    annot.refresh();
    setSignIndicator(instance, annot, false);
  }
}
```

- **Active field (own role)**: can be signed, and a "Sign here" indicator is shown until it is signed
- **Inactive fields (other roles)**: the `READ_ONLY` widget flag is set, so they cannot be clicked or signed, and no indicator is shown
- **Safeguard**: an `annotationChanged` listener deletes any signature that ends up associated with another role's field and shows an error message

Because the role → field mapping lives in data, supporting another document or adding a role only requires updating `agreements.json` (and the `Role` type), not the viewer logic.

## Key point 2: saving only the role's signature as XFDF

The signature tool is switched to annotation signing mode, so a signature is created as a standalone annotation associated with the widget instead of being baked into the widget's appearance. This makes it possible to export each role's signature on its own:

```ts
signatureTool.setSigningMode(Tools.SignatureCreateTool.SigningModes.ANNOTATION);
```

When the user clicks "Confirm signature", `confirmSignature` takes only the signature annotation associated with the user's own widget and exports it as XFDF, without widgets or form fields:

```ts
const annot = widgets?.[myRole]?.getAssociatedSignatureAnnotation();
const xfdf = await annotationManager.exportAnnotations({
  annotationList: [annot],
  widgets: false,
  fields: false,
});
annotationManager.deleteAnnotation(annot, { force: true });
saveSignature(agreement.id, myRole, xfdf);
```

- **Saved per role**: `saveSignature` (`src/lib/signatures.ts`) stores the XFDF under a per-role key (`parallel-signature:signature:<agreementId>:<role>`), so one party's save or revoke never overwrites the other party's signature
- **Minimal XFDF**: because `widgets` and `fields` are excluded, the XFDF contains only the signature itself, not the state of the whole PDF form
- **Restoring**: each role's saved XFDF is imported with `importAnnotations`, attaches automatically to the overlapping signature widget, and is set to `ReadOnly`. The hand-drawn original is deleted and replaced by this read-only imported copy
- **Combining**: when both signatures exist, "Download signed PDF" exports all annotations and outputs a flattened PDF via `getFileData({ xfdfString, flatten: true })`

## Setup

```sh
npm install   # postinstall copies the WebViewer assets to public/lib/webviewer
npm run dev
```

Open http://localhost:5173 and log in with one of the following accounts (`src/data/users.json`).

| Username | Password | Role | Signable field |
| --- | --- | --- | --- |
| `seller` | `seller` | Seller (THE VENDOR) | `formSignature_p1_1` |
| `buyer` | `buyer` | Buyer (THE BANK) | `formSignature_p1_2` |

An Apryse license key is optional. To set one, copy `.env.example` to `.env` and set `VITE_APRYSE_LICENSE_KEY`.

## Pages

| Path | Description |
| --- | --- |
| `/login` | Simple username/password login |
| `/agreements` | Agreement list (signature status per role, signature reset) |
| `/agreements/:id` | Agreement viewer. Users can sign only the signature field for their own role |

## Signing flow

1. The agreement PDF (`public/files/legal-contract_with-form-fields.pdf`) is loaded, and roles are mapped to
   signature fields via `signatureFields` in `src/data/agreements.json`
2. Signature fields belonging to roles other than the logged-in user's are read-only and cannot be signed
3. When users sign their own field and click "Confirm signature", only that signature annotation is saved as XFDF
4. The other party's signature is overlaid from the saved XFDF as read-only. Once both parties have signed,
   a flattened PDF can be downloaded

Login state is per tab (sessionStorage), while signatures are shared across the browser (localStorage).
If you log in as the seller and the buyer in two separate tabs, each party's signature is reflected in the other tab in real time.

## Notes

- Authentication and storage are simplified implementations for demo purposes only. Do not use them in production
