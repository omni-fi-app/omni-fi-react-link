import { useState, useEffect, useCallback, useRef } from "react";
import { type OmniFIConfig } from "./types";

// The future CDN URL where we will host the compiled index.global.js from our monorepo
const SCRIPT_URL = "https://cdn.omni-fi.co/v1/omni-fi-connect.js";

interface UseOmniFILinkResult {
  open: () => void;
  isReady: boolean;
  error: Error | null;
}

export function useOmniFILink(config: OmniFIConfig): UseOmniFILinkResult {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Keep a mutable ref of the config so we don't trigger re-renders if the developer changes callbacks
  const configRef = useRef(config);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    // If the script is already on the page, just mark as ready
    if (window.OmniFI) {
      setIsReady(true);
      return;
    }

    // Check if we are already injecting it to prevent duplicates
    let script = document.querySelector(
      `script[src="${SCRIPT_URL}"]`,
    ) as HTMLScriptElement;

    if (!script) {
      script = document.createElement("script");
      script.src = SCRIPT_URL;
      script.async = true;
      document.head.appendChild(script);
    }

    const handleLoad = () => setIsReady(true);
    const handleError = () => setError(new Error("Failed to load Omni-FI SDK"));

    script.addEventListener("load", handleLoad);
    script.addEventListener("error", handleError);

    return () => {
      script.removeEventListener("load", handleLoad);
      script.removeEventListener("error", handleError);
    };
  }, []);

  const open = useCallback(() => {
    if (!window.OmniFI) {
      console.error("Omni-FI SDK is not loaded yet.");
      return;
    }

    // Call the vanilla JS connect method
    window.OmniFI.connect(configRef.current);
  }, []);

  return { open, isReady, error };
}
