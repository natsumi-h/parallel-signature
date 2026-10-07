import WebViewer, {
  type WebViewerInstance,
  type WebViewerOptions,
} from "@pdftron/webviewer";
import { useEffect, useRef, useState } from "react";

const licenseKey = import.meta.env.VITE_APRYSE_LICENSE_KEY as
  | string
  | undefined;

/**
 * Initializes WebViewer in the container element only once and sets the UI language to English.
 * Disposes of the UI when the component unmounts.
 */
export function useWebViewer(options: Partial<WebViewerOptions> = {}) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const [instance, setInstance] = useState<WebViewerInstance | null>(null);
  const optionsRef = useRef(options);

  useEffect(() => {
    const element = viewerRef.current;
    if (!element) return;
    let disposed = false;
    let created: WebViewerInstance | null = null;

    WebViewer(
      {
        path: "/lib/webviewer",
        licenseKey: licenseKey || undefined,
        ...optionsRef.current,
      },
      element,
    ).then(async (inst) => {
      created = inst;
      if (disposed) {
        inst.UI.dispose();
        return;
      }
      await inst.UI.setLanguage("en");
      setInstance(inst);
    });

    return () => {
      disposed = true;
      created?.UI.dispose();
      element.innerHTML = "";
    };
  }, []);

  return { viewerRef, instance };
}
