import { useState, useEffect, useCallback, useRef } from "react";
import {
  type OmniFIConfig,
  type OmniFIInstance,
  type OmniFITheme,
  type OmniFILanguage,
} from "./types";

// Default CDN URL for the Omni-FI Connect script.
// Consumers can override this via OmniFIConfig.scriptUrl for version-pinning.
const SCRIPT_URL = "https://cdn.omni-fi.co/v1/omni-fi-connect.js";

interface UseOmniFILinkResult {
  /**
   * Opens the OmniFI Link widget.
   *
   * @throws {Error} If `window.OmniFI` is not defined — the loader script must
   * be present before calling `open()`. This is a programming error, not a
   * runtime failure, and is intentionally thrown rather than reflected in the
   * `error` state property (which only tracks script-load failures).
   */
  open: () => void;
  destroy: () => void;
  isReady: boolean;
  error: Error | null;
  setTheme: (theme: OmniFITheme) => void;
  setLanguage: (lang: OmniFILanguage) => void;
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

    // If the script is already on the page, just mark as ready and register cleanup
    if (window.OmniFI) {
      setIsReady(true);
      return () => {
        instanceRef.current?.destroy();
      };
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

    // Check if we are already injecting it to prevent duplicates
    let script = document.querySelector<HTMLScriptElement>(
      `script[src="${scriptUrl}"]`,
    );

    if (!script) {
      script = document.createElement("script");
      script.src = scriptUrl;
      script.async = true;
      // Attach listeners before appending — defensive against any cached-load edge cases
      script.addEventListener("load", handleLoad);
      script.addEventListener("error", handleError);
      document.head.appendChild(script);
    } else {
      script.addEventListener("load", handleLoad);
      script.addEventListener("error", handleError);
    }

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
      throw new Error(
        "[OmniFI] SDK not loaded. Ensure the OmniFI loader script is present before calling open().",
      );
    }

    // Destroy any existing widget instance before opening a new one
    instanceRef.current?.destroy();

    // Capture the instance so we can interact with it later
    instanceRef.current = window.OmniFI.connect(configRef.current);
  }, []);

  const setTheme = useCallback((theme: OmniFITheme) => {
    instanceRef.current?.setTheme(theme);
  }, []);

  const setLanguage = useCallback((lang: OmniFILanguage) => {
    instanceRef.current?.setLanguage(lang);
  }, []);

  return { open, destroy, isReady, error, setTheme, setLanguage };
}
