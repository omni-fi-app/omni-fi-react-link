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

  // Clean up the DOM and the global window object before each test
  beforeEach(() => {
    document.head.innerHTML = "";
    delete window.OmniFI;
  });

  const mockConfig: OmniFIConfig = {
    token: "link-test-token",
    onSuccess: mock(() => {}),
  };

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
});
