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
  // Snapshot the loader environment at first-mount script-load time. The
  // loader script tag can only be injected once per page (a second injection
  // would race against / shadow the first), so the `env` that drove the
  // URL choice is fixed for the page's lifetime. Capturing it here means
  // a subsequent rerender that changes `config.env` cannot cause
  // `connect()` to ship a `environment:` value that disagrees with the
  // script currently on the page. The lower-cased "loader env" form
  // (`'local' | 'staging' | 'production'`) is what `window.OmniFI.connect()`
  // expects; we snapshot the resolved form, not the input form.
  const loaderEnvRef = useRef<ReturnType<typeof getLoaderEnvironment> | null>(
    null,
  );

  useEffect(() => {
    // Help developers spot post-mount env changes that the SDK won't honour.
    // Loader-script URL is locked at mount; changing env after won't reload
    // the script, and we deliberately ignore the change (rather than
    // re-injecting and tearing down an open widget). Warn once per change so
    // host-app effects with unstable identity don't spam the console.
    if (
      loaderEnvRef.current !== null &&
      configRef.current.env !== config.env
    ) {
      console.warn(
        `[omni-fi/react-link] OmniFIConfig.env changed after mount (`,
        configRef.current.env,
        "→",
        config.env,
        "). The change is ignored — the loader script URL was locked at first mount. Set env once at mount time; mount the hook on a new key if you need to switch environments at runtime.",
      );
    }
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    // scriptUrl override wins over env for the URL — escape hatch for
    // version pinning / self-hosting. env (default 'production') picks
    // the CDN URL otherwise. The matching `environment:` value passed to
    // `connect()` (snapshotted into loaderEnvRef below) is always derived
    // from `env` — `scriptUrl` is URL-only, NOT a back-channel for env.
    // Callers who set a custom staging/dev `scriptUrl` MUST also set the
    // matching `env`; otherwise the loaded script and the widget iframe
    // origin can disagree.
    const scriptUrl =
      configRef.current.scriptUrl ?? getScriptUrl(configRef.current.env);

    // Lock the loader env for the rest of the page lifetime — see ref docs.
    loaderEnvRef.current = getLoaderEnvironment(configRef.current.env);

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
    // iframe origin. Use the SNAPSHOT captured at script-load time so the
    // iframe origin always matches the script that's on the page —
    // changing `config.env` between mount and `open()` does not cause a
    // mismatch. Falls back to 'production' if `open()` is somehow called
    // before the script-load effect ran (shouldn't happen — the `isReady`
    // guard above runs first — but the fallback keeps the type narrow).
    instanceRef.current = window.OmniFI.connect({
      ...configRef.current,
      environment: loaderEnvRef.current ?? "production",
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
