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
import { useOmniFILink } from "../useOmniFILink";
import {
  type OmniFIConfig,
  type OmniFISuccessPayload,
  type OmniFIConnectionLinkedPayload,
  type OmniFIError,
  OMNIFI_EVENTS,
} from "../types";

/**
 * SDK passthrough regression tests for the session-token exchange feature.
 *
 * The widget now performs a session-token exchange internally (link-token →
 * session-token). The SDK's responsibility is unchanged: it passes `token`
 * through to `window.OmniFI.connect()` which the loader uses to construct the
 * iframe URL. These tests verify that nothing in the SDK intercepts, validates,
 * or transforms the token, and that all callback shapes are correct.
 */
describe("SDK passthrough — session-token exchange regression", () => {
  beforeAll(() => {
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

  beforeEach(() => {
    document.head.innerHTML = "";
    document.body.innerHTML = "";
    delete window.OmniFI;
  });

  // ---------------------------------------------------------------------------
  // Token passthrough
  // ---------------------------------------------------------------------------

  test("open() passes token to loader unchanged and loader creates iframe with token in URL", () => {
    const onSuccess = mock((_payload: OmniFISuccessPayload) => {});

    const connectMock = mock((config: OmniFIConfig) => {
      // Simulate the loader creating an iframe with the token in the URL
      const iframe = document.createElement("iframe");
      iframe.src = `https://connect.omni-fi.co/link?token=${config.token}`;
      document.body.appendChild(iframe);
      return {
        destroy: mock(() => { iframe.remove(); }),
        setTheme: mock(() => {}),
        setLanguage: mock(() => {}),
      };
    });

    window.OmniFI = { connect: connectMock };

    const { result } = renderHook(() =>
      useOmniFILink({ token: "test-link-token-123", onSuccess }),
    );

    act(() => {
      result.current.open();
    });

    // SDK passed the token to the loader without modification
    expect(connectMock).toHaveBeenCalledWith(
      expect.objectContaining({ token: "test-link-token-123" }),
    );

    // Loader (simulated) embedded the token in the iframe URL
    const iframe = document.querySelector<HTMLIFrameElement>("iframe");
    expect(iframe).not.toBeNull();
    expect(iframe?.src).toContain("token=test-link-token-123");
  });

  test("arbitrary token strings (session tokens, UUIDs) pass through without modification", () => {
    const tokens = [
      "link-sandbox-abc123",
      "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "eyJhbGciOiJIUzI1NiJ9.payload.signature",
    ];

    for (const token of tokens) {
      const connectMock = mock(() => ({
        destroy: mock(() => {}),
        setTheme: mock(() => {}),
        setLanguage: mock(() => {}),
      }));

      window.OmniFI = { connect: connectMock };

      const { result, unmount } = renderHook(() =>
        useOmniFILink({ token, onSuccess: mock(() => {}) }),
      );

      try {
        act(() => {
          result.current.open();
        });

        expect(connectMock).toHaveBeenCalledWith(
          expect.objectContaining({ token }),
        );
      } finally {
        unmount();
        document.head.innerHTML = "";
        delete window.OmniFI;
      }
    }
  });

  // ---------------------------------------------------------------------------
  // onSuccess — new multi-connection payload
  // ---------------------------------------------------------------------------

  test("onSuccess receives the new multi-connection payload from the loader", () => {
    const onSuccess = mock((_payload: OmniFISuccessPayload) => {});
    let capturedConfig: OmniFIConfig | null = null;

    window.OmniFI = {
      connect: mock((config: OmniFIConfig) => {
        capturedConfig = config;
        return {
          destroy: mock(() => {}),
          setTheme: mock(() => {}),
          setLanguage: mock(() => {}),
        };
      }),
    };

    const { result } = renderHook(() =>
      useOmniFILink({ token: "link-test", onSuccess }),
    );

    act(() => {
      result.current.open();
    });

    expect(capturedConfig).not.toBeNull();

    // Simulate the loader calling onSuccess after the widget completes
    const successPayload: OmniFISuccessPayload = {
      connections: [
        { publicToken: "public-token-abc", institutionId: "inst-001", accountType: "personal" },
        { publicToken: "public-token-def", institutionId: "inst-002", accountType: "business" },
      ],
    };

    act(() => {
      capturedConfig!.onSuccess(successPayload);
    });

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith(successPayload);
  });

  test("onSuccess payload contains all connections with publicToken and institutionId", () => {
    const receivedPayload = mock((_payload: OmniFISuccessPayload) => {});
    let capturedConfig: OmniFIConfig | null = null;

    window.OmniFI = {
      connect: mock((config: OmniFIConfig) => {
        capturedConfig = config;
        return {
          destroy: mock(() => {}),
          setTheme: mock(() => {}),
          setLanguage: mock(() => {}),
        };
      }),
    };

    const { result } = renderHook(() =>
      useOmniFILink({ token: "link-test", onSuccess: receivedPayload }),
    );

    act(() => {
      result.current.open();
    });

    const payload: OmniFISuccessPayload = {
      connections: [{ publicToken: "pt-xyz", institutionId: "bank-mcb", accountType: "personal" }],
    };

    act(() => {
      capturedConfig!.onSuccess(payload);
    });

    const calls = receivedPayload.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const [calledWith] = calls[0];
    expect(calledWith.connections).toHaveLength(1);
    expect(calledWith.connections[0].publicToken).toBe("pt-xyz");
    expect(calledWith.connections[0].institutionId).toBe("bank-mcb");
    expect(calledWith.connections[0].accountType).toBe("personal");
  });

  // ---------------------------------------------------------------------------
  // onError callback
  // ---------------------------------------------------------------------------

  test("onError callback fires when the loader reports an error", () => {
    const onError = mock((_error: OmniFIError) => {});
    let capturedConfig: OmniFIConfig | null = null;

    window.OmniFI = {
      connect: mock((config: OmniFIConfig) => {
        capturedConfig = config;
        return {
          destroy: mock(() => {}),
          setTheme: mock(() => {}),
          setLanguage: mock(() => {}),
        };
      }),
    };

    const { result } = renderHook(() =>
      useOmniFILink({ token: "link-test", onSuccess: mock(() => {}), onError }),
    );

    act(() => {
      result.current.open();
    });

    const error: OmniFIError = {
      code: "INVALID_TOKEN",
      message: "The provided link token is invalid or expired.",
    };

    act(() => {
      capturedConfig!.onError!(error);
    });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(error);
  });

  // ---------------------------------------------------------------------------
  // onExit callback
  // ---------------------------------------------------------------------------

  test("onExit callback fires when the user closes the widget", () => {
    const onExit = mock(() => {});
    let capturedConfig: OmniFIConfig | null = null;

    window.OmniFI = {
      connect: mock((config: OmniFIConfig) => {
        capturedConfig = config;
        return {
          destroy: mock(() => {}),
          setTheme: mock(() => {}),
          setLanguage: mock(() => {}),
        };
      }),
    };

    const { result } = renderHook(() =>
      useOmniFILink({ token: "link-test", onSuccess: mock(() => {}), onExit }),
    );

    act(() => {
      result.current.open();
    });

    act(() => {
      capturedConfig!.onExit!();
    });

    expect(onExit).toHaveBeenCalledTimes(1);
  });

  // ---------------------------------------------------------------------------
  // onEvent callback — connection-linked intermediate event
  // ---------------------------------------------------------------------------

  test("onEvent fires when the loader emits the connection-linked intermediate event", () => {
    const onEvent = mock(
      (_eventName: string, _metadata?: Record<string, unknown>) => {},
    );
    const onSuccess = mock((_payload: OmniFISuccessPayload) => {});
    let capturedConfig: OmniFIConfig | null = null;

    window.OmniFI = {
      connect: mock((config: OmniFIConfig) => {
        capturedConfig = config;
        return {
          destroy: mock(() => {}),
          setTheme: mock(() => {}),
          setLanguage: mock(() => {}),
        };
      }),
    };

    const { result } = renderHook(() =>
      useOmniFILink({
        token: "link-test",
        onSuccess,
        onEvent,
      }),
    );

    act(() => {
      result.current.open();
    });

    const metadata: OmniFIConnectionLinkedPayload = {
      publicToken: "pt-inst-007",
      institutionId: "inst-007",
      accountType: "personal",
    };

    act(() => {
      capturedConfig!.onEvent!(OMNIFI_EVENTS.CONNECTION_LINKED, metadata);
    });

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith(
      OMNIFI_EVENTS.CONNECTION_LINKED,
      metadata,
    );
  });

  test("connection-linked event does NOT trigger onSuccess", () => {
    const onEvent = mock(
      (_eventName: string, _metadata?: Record<string, unknown>) => {},
    );
    const onSuccess = mock((_payload: OmniFISuccessPayload) => {});
    let capturedConfig: OmniFIConfig | null = null;

    window.OmniFI = {
      connect: mock((config: OmniFIConfig) => {
        capturedConfig = config;
        return {
          destroy: mock(() => {}),
          setTheme: mock(() => {}),
          setLanguage: mock(() => {}),
        };
      }),
    };

    const { result } = renderHook(() =>
      useOmniFILink({
        token: "link-test",
        onSuccess,
        onEvent,
      }),
    );

    act(() => {
      result.current.open();
    });

    // Fire the intermediate event only
    act(() => {
      capturedConfig!.onEvent!(OMNIFI_EVENTS.CONNECTION_LINKED, {
        publicToken: "pt-inst-007",
        institutionId: "inst-007",
        accountType: "personal",
      });
    });

    expect(onEvent).toHaveBeenCalledTimes(1);
    // onSuccess must NOT have been called — connection-linked is an intermediate event
    expect(onSuccess).toHaveBeenCalledTimes(0);
  });

  test("onEvent fires with OMNIFI_EVENTS.CONNECTION_LINKED constant value", () => {
    expect(OMNIFI_EVENTS.CONNECTION_LINKED).toBe("omni-fi:connection-linked");
  });
});
