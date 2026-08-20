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
import {
  type OmniFIWidgetLoaderConfig,
  type OmniFIConnection,
  type OmniFIConnectionLinkedPayload,
  type OmniFISuccessPayload,
  OMNIFI_EVENTS,
} from "./types";

/**
 * Tests for `connectionId` propagation through the SDK surface.
 *
 * The hosted widget now writes `connectionId` onto every connection record —
 * both the per-bank `omni-fi:connection-linked` intermediate event and the
 * final `onSuccess` payload — so a host backend that loses the user mid-flow
 * can still address the persisted Connection by UUID without first having to
 * exchange the `publicToken`.
 *
 * The SDK forwards the iframe payload unchanged, so these tests verify the
 * field round-trips through both `onSuccess` and `onEvent`.
 */
describe("connectionId on connection events", () => {
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
  // Type-level: connectionId is required, not optional
  // ---------------------------------------------------------------------------

  test("OmniFIConnection requires connectionId", () => {
    const conn: OmniFIConnection = {
      publicToken: "pt-abc",
      connectionId: "conn-uuid-abc",
      institutionId: "inst-001",
      customerType: "personal",
    };

    // The field is plain string, never undefined or null.
    expect(typeof conn.connectionId).toBe("string");
    expect(conn.connectionId.length).toBeGreaterThan(0);
  });

  // ---------------------------------------------------------------------------
  // onSuccess: connectionId reaches the consumer on every connection record
  // ---------------------------------------------------------------------------

  test("onSuccess receives connectionId on every connection record", () => {
    const onSuccess = mock((_payload: OmniFISuccessPayload) => {});
    let capturedConfig: OmniFIWidgetLoaderConfig | null = null;

    window.OmniFI = {
      connect: mock((config: OmniFIWidgetLoaderConfig) => {
        capturedConfig = config;
        return {
          destroy: mock(() => {}),
          setTheme: mock(() => {}),
          setLanguage: mock(() => {}),
        };
      }),
    };

    const { result } = renderHook(() =>
      useOmniFILink({ token: "link-multi", onSuccess }),
    );

    act(() => {
      result.current.open();
    });

    const payload: OmniFISuccessPayload = {
      connections: [
        {
          publicToken: "pt-001",
          connectionId: "conn-uuid-001",
          institutionId: "inst-a",
          customerType: "personal",
        },
        {
          publicToken: "pt-002",
          connectionId: "conn-uuid-002",
          institutionId: "inst-b",
          customerType: "business",
        },
      ],
    };

    act(() => {
      capturedConfig!.onSuccess(payload.connections);
    });

    const firstCall = onSuccess.mock.calls[0];
    expect(firstCall).toBeDefined();
    const { connections } = firstCall![0];
    expect(connections[0]!.connectionId).toBe("conn-uuid-001");
    expect(connections[1]!.connectionId).toBe("conn-uuid-002");
  });

  // ---------------------------------------------------------------------------
  // connection-linked: connectionId is on the intermediate event metadata too
  // ---------------------------------------------------------------------------

  test("onEvent connection-linked carries connectionId — host can address the persisted record even if the user closes mid-flow", () => {
    const onEvent = mock(
      (_eventName: string, _metadata?: Record<string, unknown>) => {},
    );
    let capturedConfig: OmniFIWidgetLoaderConfig | null = null;

    window.OmniFI = {
      connect: mock((config: OmniFIWidgetLoaderConfig) => {
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
        onSuccess: mock(() => {}),
        onEvent,
      }),
    );

    act(() => {
      result.current.open();
    });

    const linkedMetadata: OmniFIConnectionLinkedPayload & Record<string, unknown> = {
      publicToken: "pt-linked-001",
      connectionId: "conn-uuid-linked-001",
      institutionId: "inst-mcb",
      customerType: "personal",
    };

    act(() => {
      capturedConfig!.onEvent!(OMNIFI_EVENTS.CONNECTION_LINKED, linkedMetadata);
    });

    const firstCall = onEvent.mock.calls[0];
    expect(firstCall).toBeDefined();
    const received = firstCall![1] as OmniFIConnectionLinkedPayload | undefined;
    expect(received?.connectionId).toBe("conn-uuid-linked-001");
    // Forwarded by reference — the SDK is a passthrough.
    expect(received).toBe(linkedMetadata);
  });
});
