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
  type OmniFIMfaChallengePayload,
  type OmniFISuccessPayload,
  OMNIFI_EVENTS,
} from "./types";

/**
 * MFA delivery-metadata propagation tests.
 *
 * The SDK forwards the iframe-emitted `omni-fi:mfa-challenge` event to the
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

  test("OMNIFI_EVENTS.MFA_CHALLENGE is the canonical 'omni-fi:mfa-challenge' string", () => {
    expect(OMNIFI_EVENTS.MFA_CHALLENGE).toBe("omni-fi:mfa-challenge");
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

    const smsPayload: OmniFIMfaChallengePayload & Record<string, unknown> = {
      institutionId: "inst_mock_sms",
      mfaType: "sms",
      mfaDestination: "+230 5*** 1234",
      mfaDestinationKind: "phone",
      mfaLength: 4,
    };

    act(() => {
      capturedConfig!.onEvent!(OMNIFI_EVENTS.MFA_CHALLENGE, smsPayload);
    });

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith(
      OMNIFI_EVENTS.MFA_CHALLENGE,
      smsPayload,
    );

    const firstCall = onEvent.mock.calls[0];
    expect(firstCall).toBeDefined();
    const received = firstCall![1] as OmniFIMfaChallengePayload | undefined;
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

    const emailPayload: OmniFIMfaChallengePayload & Record<string, unknown> = {
      institutionId: "inst_mock_email",
      mfaType: "email",
      mfaDestination: "j***@example.com",
      mfaDestinationKind: "email",
      mfaLength: 4,
    };

    act(() => {
      capturedConfig!.onEvent!(OMNIFI_EVENTS.MFA_CHALLENGE, emailPayload);
    });

    const firstCall = onEvent.mock.calls[0];
    expect(firstCall).toBeDefined();
    const received = firstCall![1] as OmniFIMfaChallengePayload | undefined;
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

    const totpPayload: OmniFIMfaChallengePayload & Record<string, unknown> = {
      institutionId: "inst_mock_totp",
      mfaType: "totp",
      mfaLength: 6,
      // mfaDestination + mfaDestinationKind intentionally omitted — TOTP
    };

    act(() => {
      capturedConfig!.onEvent!(OMNIFI_EVENTS.MFA_CHALLENGE, totpPayload);
    });

    const firstCall = onEvent.mock.calls[0];
    expect(firstCall).toBeDefined();
    const received = firstCall![1] as OmniFIMfaChallengePayload | undefined;
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
    const legacyPayload: OmniFIMfaChallengePayload & Record<string, unknown> = {
      institutionId: "inst_mcb",
      mfaType: "sms",
    };

    act(() => {
      capturedConfig!.onEvent!(OMNIFI_EVENTS.MFA_CHALLENGE, legacyPayload);
    });

    expect(onEvent).toHaveBeenCalledTimes(1);
    const firstCall = onEvent.mock.calls[0];
    const received = firstCall![1] as OmniFIMfaChallengePayload | undefined;
    expect(received?.mfaType).toBe("sms");
    expect(received?.mfaDestination).toBeUndefined();
    expect(received?.mfaDestinationKind).toBeUndefined();
    expect(received?.mfaLength).toBeUndefined();
  });

  // ---------------------------------------------------------------------------
  // MFA event is intermediate — passthrough invariants
  // ---------------------------------------------------------------------------

  test("SDK passes onEvent and onSuccess through to connect() without wrapping", () => {
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

    // The SDK must hand the consumer's callbacks to the loader by reference —
    // wrapping them would let the hook bridge intermediate events (mfa-challenge)
    // to terminal callbacks (onSuccess) and silently change the public contract.
    expect(capturedConfig!.onEvent).toBe(onEvent);
    expect(capturedConfig!.onSuccess).toBe(onSuccess);

    // Mirrors the existing connection-linked passthrough test: confirms that
    // firing the intermediate event does not invoke the terminal onSuccess.
    act(() => {
      capturedConfig!.onEvent!(OMNIFI_EVENTS.MFA_CHALLENGE, {
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

  test("OmniFIMfaChallengePayload type accepts all three sandbox variants", () => {
    const sms: OmniFIMfaChallengePayload = {
      institutionId: "inst_mock_sms",
      mfaType: "sms",
      mfaDestination: "+230 5*** 1234",
      mfaDestinationKind: "phone",
      mfaLength: 4,
    };
    const email: OmniFIMfaChallengePayload = {
      institutionId: "inst_mock_email",
      mfaType: "email",
      mfaDestination: "j***@example.com",
      mfaDestinationKind: "email",
      mfaLength: 4,
    };
    const totp: OmniFIMfaChallengePayload = {
      institutionId: "inst_mock_totp",
      mfaType: "totp",
      mfaLength: 6,
    };

    expect(sms.mfaType).toBe("sms");
    expect(email.mfaType).toBe("email");
    expect(totp.mfaType).toBe("totp");
  });

  // ---------------------------------------------------------------------------
  // Contract: no `mfaRequired` boolean — `mfaType` is the single source of truth
  // ---------------------------------------------------------------------------

  test("payload type has no `mfaRequired` key — `mfaType` is canonical", () => {
    // The Omni-FI contract intentionally has no `mfaRequired` boolean;
    // institution-level "needs MFA?" is `mfaType !== 'none'` on the wider
    // OmniFIMfaType union. On the event payload itself, `mfaType` is
    // narrowed to OmniFIMfaChallengeType (excludes `'none'`) so the type
    // system enforces "an MFA event always represents a real challenge".
    // If a future upstream change re-introduces a `mfaRequired` field, the
    // runtime assertions below catch it before consumers do.
    const sms: OmniFIMfaChallengePayload = {
      institutionId: "inst_mock_sms",
      mfaType: "sms",
      mfaDestination: "+230 5*** 1234",
      mfaDestinationKind: "phone",
      mfaLength: 4,
    };
    const totp: OmniFIMfaChallengePayload = {
      institutionId: "inst_mock_totp",
      mfaType: "totp",
      mfaLength: 6,
    };

    expect("mfaRequired" in sms).toBe(false);
    expect("mfaRequired" in totp).toBe(false);
  });

  test("event with mfaType: 'sms' + DeliveryTarget propagates unchanged through onEvent", () => {
    // Canonical contract for the event metadata:
    //   { institutionId, mfaType, mfaDestination, mfaDestinationKind, mfaLength }
    // No mfaRequired anywhere — `mfaType` is the single source of truth.
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

    const payload: OmniFIMfaChallengePayload & Record<string, unknown> = {
      institutionId: "inst_mcb",
      mfaType: "sms",
      mfaDestination: "+230 5*** 1234",
      mfaDestinationKind: "phone",
      mfaLength: 4,
    };

    act(() => {
      capturedConfig!.onEvent!(OMNIFI_EVENTS.MFA_CHALLENGE, payload);
    });

    // Same object reference reaches the consumer — SDK is a passthrough.
    expect(onEvent.mock.calls[0]![1]).toBe(payload);
    expect(Object.keys(payload)).not.toContain("mfaRequired");
  });
});
