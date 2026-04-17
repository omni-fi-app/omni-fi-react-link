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

  test("initializes, injects the script, and becomes ready", () => {
    const { result } = renderHook(() => useOmniFILink(mockConfig));

    // Verify the script tag was appended to the document head
    const script = document.querySelector<HTMLScriptElement>(
      'script[src="https://cdn.omni-fi.co/v1/omni-fi-connect.js"]',
    );
    expect(script).not.toBeNull();
    expect(script?.async).toBe(true);

    // Initial state should be false
    expect(result.current.isReady).toBe(false);

    // Manually simulate the browser finishing the script download
    act(() => {
      script?.dispatchEvent(new window.Event("load"));
    });

    // The hook should now instantly be ready
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
});
