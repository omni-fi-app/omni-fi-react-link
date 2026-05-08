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
  type OmniFIMfaRequiredPayload,
  type OmniFISuccessPayload,
  OMNIFI_EVENTS,
} from "./types";

/**
 * MFA delivery-metadata propagation tests.
 *
 * The SDK forwards the iframe-emitted `omni-fi:mfa-required` event to the
 * consumer's `onEvent` callback unchanged. These tests verify that the
 * `mfaType`, `mfaDestination`, `mfaDestinationKind`, and `mfaLength` fields
 * round-trip without mutation across all three sandbox MFA variants:
 *
 *   - SMS OTP    → `inst_mock_sms`
 *   - EMAIL      → `inst_mock_email`
 *   - TOTP       → `inst_mock_totp`
 */
describe("MFA delivery metadata — onEvent propagation", () => {
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
  // Event constant
  // ---------------------------------------------------------------------------

  test("OMNIFI_EVENTS.MFA_REQUIRED is the canonical 'omni-fi:mfa-required' string", () => {
    expect(OMNIFI_EVENTS.MFA_REQUIRED).toBe("omni-fi:mfa-required");
  });

  // ---------------------------------------------------------------------------
  // SMS — inst_mock_sms
  // ---------------------------------------------------------------------------

  test("SMS MFA event propagates mfaDestination + kind + length unchanged", () => {
    const onEvent = mock(
      (_eventName: string, _metadata?: Record<string, unknown>) => {},
    );
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
        onSuccess: mock(() => {}),
        onEvent,
      }),
    );

    act(() => {
      result.current.open();
    });

    const smsPayload: OmniFIMfaRequiredPayload & Record<string, unknown> = {
      institutionId: "inst_mock_sms",
      mfaType: "sms",
      mfaDestination: "+230 5*** 1234",
      mfaDestinationKind: "phone",
      mfaLength: 4,
    };

    act(() => {
      capturedConfig!.onEvent!(OMNIFI_EVENTS.MFA_REQUIRED, smsPayload);
    });

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith(
      OMNIFI_EVENTS.MFA_REQUIRED,
      smsPayload,
    );

    const firstCall = onEvent.mock.calls[0];
    expect(firstCall).toBeDefined();
    const received = firstCall![1] as OmniFIMfaRequiredPayload | undefined;
    expect(received?.institutionId).toBe("inst_mock_sms");
    expect(received?.mfaType).toBe("sms");
    expect(received?.mfaDestination).toBe("+230 5*** 1234");
    expect(received?.mfaDestinationKind).toBe("phone");
    expect(received?.mfaLength).toBe(4);
  });

  // ---------------------------------------------------------------------------
  // EMAIL — inst_mock_email
  // ---------------------------------------------------------------------------

  test("EMAIL MFA event propagates masked email destination unchanged", () => {
    const onEvent = mock(
      (_eventName: string, _metadata?: Record<string, unknown>) => {},
    );
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
        onSuccess: mock(() => {}),
        onEvent,
      }),
    );

    act(() => {
      result.current.open();
    });

    const emailPayload: OmniFIMfaRequiredPayload & Record<string, unknown> = {
      institutionId: "inst_mock_email",
      mfaType: "email",
      mfaDestination: "j***@example.com",
      mfaDestinationKind: "email",
      mfaLength: 4,
    };

    act(() => {
      capturedConfig!.onEvent!(OMNIFI_EVENTS.MFA_REQUIRED, emailPayload);
    });

    const firstCall = onEvent.mock.calls[0];
    expect(firstCall).toBeDefined();
    const received = firstCall![1] as OmniFIMfaRequiredPayload | undefined;
    expect(received?.institutionId).toBe("inst_mock_email");
    expect(received?.mfaType).toBe("email");
    expect(received?.mfaDestination).toBe("j***@example.com");
    expect(received?.mfaDestinationKind).toBe("email");
    expect(received?.mfaLength).toBe(4);
  });

  // ---------------------------------------------------------------------------
  // TOTP — inst_mock_totp
  // ---------------------------------------------------------------------------

  test("TOTP MFA event omits destination fields and carries mfaLength=6", () => {
    const onEvent = mock(
      (_eventName: string, _metadata?: Record<string, unknown>) => {},
    );
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
        onSuccess: mock(() => {}),
        onEvent,
      }),
    );

    act(() => {
      result.current.open();
    });

    const totpPayload: OmniFIMfaRequiredPayload & Record<string, unknown> = {
      institutionId: "inst_mock_totp",
      mfaType: "totp",
      mfaLength: 6,
      // mfaDestination + mfaDestinationKind intentionally omitted — TOTP
    };

    act(() => {
      capturedConfig!.onEvent!(OMNIFI_EVENTS.MFA_REQUIRED, totpPayload);
    });

    const firstCall = onEvent.mock.calls[0];
    expect(firstCall).toBeDefined();
    const received = firstCall![1] as OmniFIMfaRequiredPayload | undefined;
    expect(received?.institutionId).toBe("inst_mock_totp");
    expect(received?.mfaType).toBe("totp");
    expect(received?.mfaLength).toBe(6);
    // Must be undefined, NOT null, NOT ""
    expect(received?.mfaDestination).toBeUndefined();
    expect(received?.mfaDestinationKind).toBeUndefined();
  });

  // ---------------------------------------------------------------------------
  // Backward compatibility — destination metadata absent (legacy backend)
  // ---------------------------------------------------------------------------

  test("MFA event without destination metadata still forwards through onEvent", () => {
    const onEvent = mock(
      (_eventName: string, _metadata?: Record<string, unknown>) => {},
    );
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
        onSuccess: mock(() => {}),
        onEvent,
      }),
    );

    act(() => {
      result.current.open();
    });

    // Pre-rollout shape: only mfaType + institutionId; no destination metadata.
    const legacyPayload: OmniFIMfaRequiredPayload & Record<string, unknown> = {
      institutionId: "inst_mcb",
      mfaType: "sms",
    };

    act(() => {
      capturedConfig!.onEvent!(OMNIFI_EVENTS.MFA_REQUIRED, legacyPayload);
    });

    expect(onEvent).toHaveBeenCalledTimes(1);
    const firstCall = onEvent.mock.calls[0];
    const received = firstCall![1] as OmniFIMfaRequiredPayload | undefined;
    expect(received?.mfaType).toBe("sms");
    expect(received?.mfaDestination).toBeUndefined();
    expect(received?.mfaDestinationKind).toBeUndefined();
    expect(received?.mfaLength).toBeUndefined();
  });

  // ---------------------------------------------------------------------------
  // MFA event is intermediate — does NOT trigger onSuccess
  // ---------------------------------------------------------------------------

  test("mfa-required event does NOT trigger onSuccess", () => {
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
      useOmniFILink({ token: "link-test", onSuccess, onEvent }),
    );

    act(() => {
      result.current.open();
    });

    act(() => {
      capturedConfig!.onEvent!(OMNIFI_EVENTS.MFA_REQUIRED, {
        institutionId: "inst_mock_sms",
        mfaType: "sms",
        mfaDestination: "+230 5*** 1234",
        mfaDestinationKind: "phone",
        mfaLength: 4,
      });
    });

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledTimes(0);
  });

  // ---------------------------------------------------------------------------
  // Type compatibility — payload type accepts the canonical sandbox shapes
  // ---------------------------------------------------------------------------

  test("OmniFIMfaRequiredPayload type accepts all three sandbox variants", () => {
    const sms: OmniFIMfaRequiredPayload = {
      institutionId: "inst_mock_sms",
      mfaType: "sms",
      mfaDestination: "+230 5*** 1234",
      mfaDestinationKind: "phone",
      mfaLength: 4,
    };
    const email: OmniFIMfaRequiredPayload = {
      institutionId: "inst_mock_email",
      mfaType: "email",
      mfaDestination: "j***@example.com",
      mfaDestinationKind: "email",
      mfaLength: 4,
    };
    const totp: OmniFIMfaRequiredPayload = {
      institutionId: "inst_mock_totp",
      mfaType: "totp",
      mfaLength: 6,
    };

    expect(sms.mfaType).toBe("sms");
    expect(email.mfaType).toBe("email");
    expect(totp.mfaType).toBe("totp");
  });
});
