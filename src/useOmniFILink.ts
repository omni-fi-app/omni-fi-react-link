import { useState, useEffect, useCallback, useRef } from "react";
import { type OmniFIConfig, type OmniFIInstance } from "./types";

// Default CDN URL for the Omni-FI Connect script.
// Consumers can override this via OmniFIConfig.scriptUrl for version-pinning.
const SCRIPT_URL = "https://cdn.omni-fi.co/v1/omni-fi-connect.js";

interface UseOmniFILinkResult {
  open: () => void;
  destroy: () => void;
  isReady: boolean;
  error: Error | null;
  setTheme: (theme: "light" | "dark" | "system") => void;
  setLanguage: (lang: "en" | "fr") => void;
}

export function useOmniFILink(config: OmniFIConfig): UseOmniFILinkResult {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Keep a mutable ref of the config so we don't trigger re-renders if the developer changes callbacks
  const configRef = useRef(config);
  // Store the active widget instance so we can call methods on it or destroy it
  const instanceRef = useRef<OmniFIInstance | null>(null);

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
    const handleError = (event: Event) =>
      setError(
        new Error(
          `Failed to load Omni-FI SDK script from ${scriptUrl}${
            event.type ? ` (event: ${event.type})` : ""
          }`,
        ),
      );

    script.addEventListener("load", handleLoad);
    script.addEventListener("error", handleError);

    return () => {
      script.removeEventListener("load", handleLoad);
      script.removeEventListener("error", handleError);

      // Clean up the widget if the React component unmounts
      instanceRef.current?.destroy();
    };
  }, []);

  const destroy = useCallback(() => {
    instanceRef.current?.destroy();
    instanceRef.current = null;
  }, []);

  const open = useCallback(() => {
    if (!window.OmniFI) {
      console.error("Omni-FI SDK is not loaded yet.");
      return;
    }

    // Destroy any existing widget instance before opening a new one
    instanceRef.current?.destroy();

    // Capture the instance so we can interact with it later
    instanceRef.current = window.OmniFI.connect(configRef.current);
  }, []);

  const setTheme = useCallback((theme: "light" | "dark" | "system") => {
    instanceRef.current?.setTheme(theme);
  }, []);

  const setLanguage = useCallback((lang: "en" | "fr") => {
    instanceRef.current?.setLanguage(lang);
  }, []);

  return { open, destroy, isReady, error, setTheme, setLanguage };
}
