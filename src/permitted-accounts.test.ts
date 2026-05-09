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
  type OmniFIConfig,
  type OmniFIConnection,
  type OmniFISuccessPayload,
  type OmniFIConnectionLinkedPayload,
  OMNIFI_EVENTS,
} from "./types";

/**
 * Tests for permittedAccountIds in connection events.
 *
 * B2C flows: permittedAccountIds is an array of account UUID strings
 * B2B flows: permittedAccountIds is undefined (all accounts auto-confirmed)
 */
describe("permittedAccountIds in connection events", () => {
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
  // Type compatibility — permittedAccountIds is optional on OmniFIConnection
  // ---------------------------------------------------------------------------

  test("OmniFIConnection is valid without permittedAccountIds", () => {
    const conn: OmniFIConnection = {
      publicToken: "pt-abc",
      connectionId: "conn-uuid-abc",
      institutionId: "inst-001",
      customerType: "personal",
    };

    expect(conn.permittedAccountIds).toBeUndefined();
    expect(conn.publicToken).toBe("pt-abc");
  });

  test("existing consumer destructuring { publicToken, institutionId } still works", () => {
    const payload: OmniFISuccessPayload = {
      connections: [
        { publicToken: "pt-xyz", connectionId: "conn-uuid-xyz", institutionId: "bank-mcb", customerType: "personal" },
      ],
    };

    const first = payload.connections[0];
    expect(first).toBeDefined();
    const { publicToken, institutionId } = first!;
    expect(publicToken).toBe("pt-xyz");
    expect(institutionId).toBe("bank-mcb");
  });

  // ---------------------------------------------------------------------------
  // B2C: permittedAccountIds passed through in omni-fi:success
  // ---------------------------------------------------------------------------

  test("onSuccess receives permittedAccountIds from the loader in B2C flows", () => {
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
      useOmniFILink({ token: "link-b2c-token", onSuccess }),
    );

    act(() => {
      result.current.open();
    });

    const b2cPayload: OmniFISuccessPayload = {
      connections: [
        {
          publicToken: "pt-b2c-001",
          connectionId: "conn-uuid-b2c-001",
          institutionId: "inst-mcb",
          customerType: "personal",
          permittedAccountIds: ["acc-uuid-1111", "acc-uuid-2222", "acc-uuid-3333"],
        },
      ],
    };

    act(() => {
      capturedConfig!.onSuccess(b2cPayload);
    });

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith(b2cPayload);

    const firstCall = onSuccess.mock.calls[0];
    expect(firstCall).toBeDefined();
    const receivedConn = firstCall![0].connections[0];
    expect(receivedConn).toBeDefined();
    expect(receivedConn!.permittedAccountIds).toEqual([
      "acc-uuid-1111",
      "acc-uuid-2222",
      "acc-uuid-3333",
    ]);
  });

  test("multiple connections each carry their own permittedAccountIds in onSuccess", () => {
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
      useOmniFILink({ token: "link-multi", onSuccess }),
    );

    act(() => {
      result.current.open();
    });

    const multiPayload: OmniFISuccessPayload = {
      connections: [
        {
          publicToken: "pt-001",
          connectionId: "conn-uuid-001",
          institutionId: "inst-a",
          customerType: "personal",
          permittedAccountIds: ["acc-a1", "acc-a2"],
        },
        {
          publicToken: "pt-002",
          connectionId: "conn-uuid-002",
          institutionId: "inst-b",
          customerType: "business",
          permittedAccountIds: ["acc-b1"],
        },
      ],
    };

    act(() => {
      capturedConfig!.onSuccess(multiPayload);
    });

    const firstCall = onSuccess.mock.calls[0];
    expect(firstCall).toBeDefined();
    const { connections } = firstCall![0];
    expect(connections[0]!.permittedAccountIds).toEqual(["acc-a1", "acc-a2"]);
    expect(connections[1]!.permittedAccountIds).toEqual(["acc-b1"]);
  });

  // ---------------------------------------------------------------------------
  // B2B: permittedAccountIds is undefined (all accounts auto-confirmed)
  // ---------------------------------------------------------------------------

  test("onSuccess receives undefined permittedAccountIds for B2B flows", () => {
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
      useOmniFILink({ token: "link-b2b-token", onSuccess }),
    );

    act(() => {
      result.current.open();
    });

    const b2bPayload: OmniFISuccessPayload = {
      connections: [
        {
          publicToken: "pt-b2b-001",
          connectionId: "conn-uuid-b2b-001",
          institutionId: "inst-corp",
          customerType: "business",
          // permittedAccountIds intentionally omitted — B2B auto-confirms all
        },
      ],
    };

    act(() => {
      capturedConfig!.onSuccess(b2bPayload);
    });

    const firstCall = onSuccess.mock.calls[0];
    expect(firstCall).toBeDefined();
    const receivedConn = firstCall![0].connections[0];
    expect(receivedConn).toBeDefined();
    // Must be undefined, NOT null, NOT []
    expect(receivedConn!.permittedAccountIds).toBeUndefined();
  });

  // ---------------------------------------------------------------------------
  // connection-linked event: permittedAccountIds in intermediate event (B2C)
  // ---------------------------------------------------------------------------

  test("onEvent connection-linked carries permittedAccountIds in B2C flows", () => {
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
      useOmniFILink({ token: "link-b2c", onSuccess, onEvent }),
    );

    act(() => {
      result.current.open();
    });

    const linkedMetadata: OmniFIConnectionLinkedPayload & Record<string, unknown> = {
      publicToken: "pt-linked-001",
      connectionId: "conn-uuid-linked-001",
      institutionId: "inst-linked",
      customerType: "personal",
      permittedAccountIds: ["acc-linked-1", "acc-linked-2"],
    };

    act(() => {
      capturedConfig!.onEvent!(OMNIFI_EVENTS.CONNECTION_LINKED, linkedMetadata);
    });

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith(
      OMNIFI_EVENTS.CONNECTION_LINKED,
      linkedMetadata,
    );

    const firstCall = onEvent.mock.calls[0];
    expect(firstCall).toBeDefined();
    const receivedMetadata = firstCall![1] as OmniFIConnectionLinkedPayload | undefined;
    expect(receivedMetadata?.permittedAccountIds).toEqual([
      "acc-linked-1",
      "acc-linked-2",
    ]);
  });

  test("onEvent connection-linked has no permittedAccountIds in B2B flows", () => {
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
      useOmniFILink({ token: "link-b2b", onSuccess, onEvent }),
    );

    act(() => {
      result.current.open();
    });

    const b2bLinkedMetadata: OmniFIConnectionLinkedPayload & Record<string, unknown> = {
      publicToken: "pt-b2b-linked",
      connectionId: "conn-uuid-b2b-linked",
      institutionId: "inst-corp",
      customerType: "business",
      // permittedAccountIds intentionally omitted — B2B
    };

    act(() => {
      capturedConfig!.onEvent!(OMNIFI_EVENTS.CONNECTION_LINKED, b2bLinkedMetadata);
    });

    const firstCall = onEvent.mock.calls[0];
    expect(firstCall).toBeDefined();
    const receivedMetadata = firstCall![1] as OmniFIConnectionLinkedPayload | undefined;
    expect(receivedMetadata?.permittedAccountIds).toBeUndefined();
  });
});
