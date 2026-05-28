import { useState, useEffect, useCallback, useRef } from "react";
import {
  type OmniFIConfig,
  type OmniFIInstance,
  type OmniFITheme,
  type OmniFILanguage,
} from "./types";
import { getScriptUrl, getLoaderEnvironment } from "./lib/scriptUrl";

interface UseOmniFILinkResult {
  /**
   * Opens the OmniFI Link widget.
   *
   * Wait for `isReady` to be `true` before calling this — `isReady` signals
   * that the loader script has finished loading and executing and that
   * `window.OmniFI` is available.
   *
   * @throws {Error} If called before `isReady` is `true` (i.e. `window.OmniFI`
   * is not yet set). Thrown rather than reflected in the `error` state because
   * this is a programming error, not a runtime failure.
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
    // scriptUrl override wins over env — escape hatch for version pinning /
    // self-hosting. env (default 'production') picks the CDN URL otherwise.
    const scriptUrl =
      configRef.current.scriptUrl ?? getScriptUrl(configRef.current.env);

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
        "[OmniFI] open() called before the SDK is ready. Wait for isReady to be true before calling open().",
      );
    }

    // Destroy any existing widget instance before opening a new one
    instanceRef.current?.destroy();

    // The widget loader (omni-fi-link/packages/link-loader) reads
    // `environment` ("local" | "staging" | "production") to pick its
    // iframe origin. Derive it from the SDK's public `env` field so the
    // loader sees the same env signal the SDK used for the CDN URL.
    instanceRef.current = window.OmniFI.connect({
      ...configRef.current,
      environment: getLoaderEnvironment(configRef.current.env),
    });
  }, []);

  const setTheme = useCallback((theme: OmniFITheme) => {
    instanceRef.current?.setTheme(theme);
  }, []);

  const setLanguage = useCallback((lang: OmniFILanguage) => {
    instanceRef.current?.setLanguage(lang);
  }, []);

  return { open, destroy, isReady, error, setTheme, setLanguage };
}
