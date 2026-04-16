import { useState, useEffect, useCallback, useRef } from "react";
import { type OmniFIConfig } from "./types";

// Default CDN URL for the Omni-FI Connect script.
// Consumers can override this via OmniFIConfig.scriptUrl for version-pinning.
const SCRIPT_URL = "https://cdn.omni-fi.co/v1/omni-fi-connect.js";

interface UseOmniFILinkResult {
  open: () => void;
  destroy: () => void;
  isReady: boolean;
  error: Error | null;
}

export function useOmniFILink(config: OmniFIConfig): UseOmniFILinkResult {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Keep a mutable ref of the config so we don't trigger re-renders if the developer changes callbacks
  const configRef = useRef(config);
  // Holds the destroy function returned by window.OmniFI.connect()
  const destroyFnRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    const scriptUrl = configRef.current.scriptUrl ?? SCRIPT_URL;

    // If the script is already on the page, just mark as ready
    if (window.OmniFI) {
      setIsReady(true);
      return;
    }

    // Check if we are already injecting it to prevent duplicates
    let script = document.querySelector<HTMLScriptElement>(
      `script[src="${scriptUrl}"]`,
    );

    if (!script) {
      script = document.createElement("script");
      script.src = scriptUrl;
      script.async = true;
      document.head.appendChild(script);
    }

    const handleLoad = () => setIsReady(true);
    const handleError = () =>
      setError(
        new Error(`Failed to load Omni-FI SDK script from ${scriptUrl}`),
      );

    script.addEventListener("load", handleLoad);
    script.addEventListener("error", handleError);

    return () => {
      script.removeEventListener("load", handleLoad);
      script.removeEventListener("error", handleError);
    };
  }, []);

  // Destroy the widget instance when the component unmounts
  useEffect(() => {
    return () => {
      destroyFnRef.current?.();
    };
  }, []);

  const destroy = useCallback(() => {
    destroyFnRef.current?.();
    destroyFnRef.current = null;
  }, []);

  const open = useCallback(() => {
    if (!window.OmniFI) {
      console.error("Omni-FI SDK is not loaded yet.");
      return;
    }

    // Destroy any existing widget instance before opening a new one
    destroyFnRef.current?.();

    destroyFnRef.current = window.OmniFI.connect(configRef.current).destroy;
  }, []);

  return { open, destroy, isReady, error };
}
