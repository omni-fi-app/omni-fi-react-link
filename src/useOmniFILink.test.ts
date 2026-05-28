import {
  describe,
  expect,
  test,
  beforeAll,
  afterAll,
  beforeEach,
  mock,
} from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { renderHook, act } from "@testing-library/react";
import { useOmniFILink } from "./useOmniFILink";
import { type OmniFIConfig } from "./types";

describe("useOmniFILink Hook", () => {
  beforeAll(() => {
    // Prevent Happy DOM from crashing when it sees an external script tag
    // Pass the settings directly into the registrator
    GlobalRegistrator.register({
      settings: {
        disableJavaScriptFileLoading: true,
        // Auto-complete disabled script loads so the load event fires synchronously on append
        handleDisabledFileLoadingAsSuccess: true,
      },
    });
  });

  afterAll(() => {
    GlobalRegistrator.unregister();
  });

  let mockConfig: OmniFIConfig;

  // Clean up the DOM, global state, and recreate mockConfig before each test so
  // the onSuccess mock doesn't accumulate call counts across tests.
  beforeEach(() => {
    document.head.innerHTML = "";
    delete window.OmniFI;
    mockConfig = {
      token: "link-test-token",
      onSuccess: mock(() => {}),
    };
  });

  test("initializes, injects the script, and sets isReady when it loads", () => {
    const { result } = renderHook(() => useOmniFILink(mockConfig));

    // Verify the script tag was appended to the document head
    const script = document.querySelector<HTMLScriptElement>(
      'script[src="https://cdn.omni-fi.co/v1/omni-fi-connect.js"]',
    );
    expect(script).not.toBeNull();
    expect(script?.async).toBe(true);

    // Happy DOM fires the load event synchronously during appendChild (handleDisabledFileLoadingAsSuccess),
    // so the hook is already ready — this confirms the listener is wired before append
    expect(result.current.isReady).toBe(true);
  });

  test("does not inject duplicate script tags on re-render", () => {
    const { rerender } = renderHook(() => useOmniFILink(mockConfig));

    // Force the hook to re-render multiple times
    rerender();
    rerender();

    // Query the DOM - there should still only be exactly one script tag
    const scripts = document.querySelectorAll(
      'script[src="https://cdn.omni-fi.co/v1/omni-fi-connect.js"]',
    );
    expect(scripts.length).toBe(1);
  });

  test("isReady is immediately true if window.OmniFI already exists", () => {
    // Simulate a scenario where the script was already loaded on the page
    window.OmniFI = {
      connect: mock(() => ({
        destroy: mock(() => {}),
        setTheme: mock(() => {}),
        setLanguage: mock(() => {}),
      })),
    };

    const { result } = renderHook(() => useOmniFILink(mockConfig));

    // Should be ready immediately without needing to wait for a script load
    expect(result.current.isReady).toBe(true);
  });

  test("open() throws when window.OmniFI is not defined", () => {
    const { result } = renderHook(() => useOmniFILink(mockConfig));

    // window.OmniFI is never set here — calling open() is a programming error
    expect(() => {
      act(() => {
        result.current.open();
      });
    }).toThrow("[OmniFI] open() called before the SDK is ready");
  });

  test("open() captures the returned instance and setTheme/setLanguage delegate to it", () => {
    const mockDestroy = mock(() => {});
    const mockSetTheme = mock(() => {});
    const mockSetLanguage = mock(() => {});
    const connectMock = mock(() => ({
      destroy: mockDestroy,
      setTheme: mockSetTheme,
      setLanguage: mockSetLanguage,
    }));

    window.OmniFI = { connect: connectMock };

    const { result } = renderHook(() => useOmniFILink(mockConfig));

    act(() => {
      result.current.open();
    });

    expect(connectMock).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.setTheme("dark");
    });
    expect(mockSetTheme).toHaveBeenCalledTimes(1);
    expect(mockSetTheme).toHaveBeenCalledWith("dark");

    act(() => {
      result.current.setLanguage("en-GB");
    });
    expect(mockSetLanguage).toHaveBeenCalledTimes(1);
    expect(mockSetLanguage).toHaveBeenCalledWith("en-GB");
  });

  test("destroy() calls instance.destroy() and subsequent method calls are no-ops", () => {
    const mockDestroy = mock(() => {});
    const mockSetTheme = mock(() => {});

    window.OmniFI = {
      connect: mock(() => ({
        destroy: mockDestroy,
        setTheme: mockSetTheme,
        setLanguage: mock(() => {}),
      })),
    };

    const { result } = renderHook(() => useOmniFILink(mockConfig));

    act(() => {
      result.current.open();
      result.current.destroy();
    });

    expect(mockDestroy).toHaveBeenCalledTimes(1);

    // Instance is cleared — setTheme should now be a no-op
    act(() => {
      result.current.setTheme("dark");
    });
    expect(mockSetTheme).toHaveBeenCalledTimes(0);
  });

  test("unmount destroys the active instance", () => {
    const mockDestroy = mock(() => {});

    window.OmniFI = {
      connect: mock(() => ({
        destroy: mockDestroy,
        setTheme: mock(() => {}),
        setLanguage: mock(() => {}),
      })),
    };

    const { result, unmount } = renderHook(() => useOmniFILink(mockConfig));

    act(() => {
      result.current.open();
    });

    unmount();

    expect(mockDestroy).toHaveBeenCalledTimes(1);
  });

  test("calling open() twice destroys the first instance before opening a second", () => {
    const mockDestroy1 = mock(() => {});
    const mockDestroy2 = mock(() => {});
    let callCount = 0;

    const connectMock = mock(() => {
      callCount++;
      return {
        destroy: callCount === 1 ? mockDestroy1 : mockDestroy2,
        setTheme: mock(() => {}),
        setLanguage: mock(() => {}),
      };
    });

    window.OmniFI = { connect: connectMock };

    const { result } = renderHook(() => useOmniFILink(mockConfig));

    act(() => {
      result.current.open();
    });
    act(() => {
      result.current.open();
    });

    expect(connectMock).toHaveBeenCalledTimes(2);
    expect(mockDestroy1).toHaveBeenCalledTimes(1);
    expect(mockDestroy2).toHaveBeenCalledTimes(0);
  });

  // ---------------------------------------------------------------------------
  // env field — script-URL switching
  // ---------------------------------------------------------------------------

  test("env: 'staging' injects a script tag pointing at the staging CDN", () => {
    renderHook(() =>
      useOmniFILink({
        token: "link-staging-token",
        env: "staging",
        onSuccess: mock(() => {}),
      }),
    );

    const script = document.querySelector<HTMLScriptElement>(
      'script[src="https://staging-cdn.omni-fi.co/v1/omni-fi-connect.js"]',
    );
    expect(script).not.toBeNull();
    expect(script?.async).toBe(true);
  });

  test("env: 'development' injects a script tag pointing at the local Vite dev server", () => {
    renderHook(() =>
      useOmniFILink({
        token: "link-dev-token",
        env: "development",
        onSuccess: mock(() => {}),
      }),
    );

    const script = document.querySelector<HTMLScriptElement>(
      'script[src="http://localhost:5173/omni-fi-connect.js"]',
    );
    expect(script).not.toBeNull();
  });

  test("env: 'production' is the default and resolves to the production CDN", () => {
    renderHook(() =>
      useOmniFILink({
        token: "link-prod-token",
        env: "production",
        onSuccess: mock(() => {}),
      }),
    );

    const script = document.querySelector<HTMLScriptElement>(
      'script[src="https://cdn.omni-fi.co/v1/omni-fi-connect.js"]',
    );
    expect(script).not.toBeNull();
  });

  test("explicit scriptUrl override takes precedence over env (escape hatch)", () => {
    const customUrl = "https://custom.example.com/widget-v2.js";
    renderHook(() =>
      useOmniFILink({
        token: "link-pinned-token",
        env: "staging", // would otherwise resolve to staging-cdn
        scriptUrl: customUrl,
        onSuccess: mock(() => {}),
      }),
    );

    // Custom URL was used — env was overridden.
    const customScript = document.querySelector<HTMLScriptElement>(
      `script[src="${customUrl}"]`,
    );
    expect(customScript).not.toBeNull();

    // Staging URL was NOT injected (escape hatch precedence).
    const stagingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://staging-cdn.omni-fi.co/v1/omni-fi-connect.js"]',
    );
    expect(stagingScript).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // env → widget-loader `environment` derivation at the connect() boundary
  //
  // The widget loader reads `cfg.environment` to pick its iframe origin.
  // useOmniFILink derives it from the SDK's public `env` field so consumers
  // only set one thing.
  // ---------------------------------------------------------------------------

  test("env: 'staging' forwards environment='staging' to window.OmniFI.connect", () => {
    let capturedConfig: { environment?: string } | null = null;
    window.OmniFI = {
      connect: mock((cfg: { environment?: string }) => {
        capturedConfig = cfg;
        return {
          destroy: mock(() => {}),
          setTheme: mock(() => {}),
          setLanguage: mock(() => {}),
        };
      }),
    };

    const { result } = renderHook(() =>
      useOmniFILink({
        token: "link-staging",
        env: "staging",
        onSuccess: mock(() => {}),
      }),
    );

    act(() => {
      result.current.open();
    });

    expect(capturedConfig).not.toBeNull();
    expect(capturedConfig!.environment).toBe("staging");
  });

  test("env: 'development' forwards environment='local' (loader's value name) to connect", () => {
    let capturedConfig: { environment?: string } | null = null;
    window.OmniFI = {
      connect: mock((cfg: { environment?: string }) => {
        capturedConfig = cfg;
        return {
          destroy: mock(() => {}),
          setTheme: mock(() => {}),
          setLanguage: mock(() => {}),
        };
      }),
    };

    const { result } = renderHook(() =>
      useOmniFILink({
        token: "link-dev",
        env: "development",
        onSuccess: mock(() => {}),
      }),
    );

    act(() => {
      result.current.open();
    });

    expect(capturedConfig!.environment).toBe("local");
  });

  test("env: 'production' (default) forwards environment='production' to connect", () => {
    let capturedConfig: { environment?: string } | null = null;
    window.OmniFI = {
      connect: mock((cfg: { environment?: string }) => {
        capturedConfig = cfg;
        return {
          destroy: mock(() => {}),
          setTheme: mock(() => {}),
          setLanguage: mock(() => {}),
        };
      }),
    };

    const { result } = renderHook(() =>
      useOmniFILink({
        token: "link-prod",
        // env omitted — should default to 'production'
        onSuccess: mock(() => {}),
      }),
    );

    act(() => {
      result.current.open();
    });

    expect(capturedConfig!.environment).toBe("production");
  });

  // ---------------------------------------------------------------------------
  // env is locked at mount — post-mount changes don't drift connect() vs script
  //
  // Regression for Copilot PR #9 finding 3: the loader script tag is injected
  // once on mount. If `config.env` later changes via rerender, the script on
  // the page is still the original URL. `connect()` must use the env that was
  // active when the script loaded, NOT the rerendered value, so the iframe
  // origin agrees with the loaded script.
  // ---------------------------------------------------------------------------

  test("post-mount env change does NOT change the environment forwarded to connect()", () => {
    let capturedConfig: { environment?: string } | null = null;
    // `window.OmniFI` pre-set so the `if (window.OmniFI)` short-circuit in
    // the mount effect fires (matches the script-already-loaded case). The
    // hook still has to snapshot env at mount, independent of whether the
    // script tag is freshly injected or already-on-page.
    window.OmniFI = {
      connect: mock((cfg: { environment?: string }) => {
        capturedConfig = cfg;
        return {
          destroy: mock(() => {}),
          setTheme: mock(() => {}),
          setLanguage: mock(() => {}),
        };
      }),
    };

    // Mount with env=staging.
    const { result, rerender } = renderHook(
      (props: { env: "staging" | "production" }) =>
        useOmniFILink({
          token: "link-rerender",
          env: props.env,
          onSuccess: mock(() => {}),
        }),
      { initialProps: { env: "staging" as const } },
    );

    // Rerender with env=production. The hook MUST ignore the change for the
    // purpose of the connect() environment so the iframe runtime env can't
    // disagree with the script that was loaded at mount.
    rerender({ env: "production" });

    act(() => {
      result.current.open();
    });

    // connect() received the SNAPSHOT env (staging), not the latest (production).
    // Without the snapshot, this would be 'production' and the iframe would
    // try to render in prod mode against whatever script was loaded at mount.
    expect(capturedConfig!.environment).toBe("staging");
  });
});
