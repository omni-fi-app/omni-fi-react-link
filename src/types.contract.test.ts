import { describe, expect, test } from "bun:test";
import {
  OMNIFI_EVENTS,
  type OmniFIConnection,
  type OmniFIErrorCode,
  type OmniFIConfig,
  type OmniFIEventType,
  type OmniFIInlineErrorPayload,
  type OmniFISuccessPayload,
  type OmniFIWidgetLoaderConfig,
} from "./types";

/**
 * Contract tests: this SDK's public type surface vs the widget's.
 *
 * The widget owns the contract in `omni-fi-link/packages/shared/src/index.ts`
 * (`OmniFILinkedConnection`, `OMNIFI_EVENTS`) and emits terminal error codes
 * from `omni-fi-link/apps/link-app/src/screens/errorUtils.ts`. This SDK only
 * re-declares that surface for TypeScript consumers — `useOmniFILink` spreads
 * the host's config straight into `window.OmniFI.connect()`, so every field
 * the widget posts already arrives at `onSuccess` at runtime whatever these
 * types say.
 *
 * Which is exactly why the drift was invisible: nothing broke, consumers just
 * had to cast. These tests make the surface assertable.
 *
 * **Most of them are compile-time.** `bun test` strips types without checking
 * them, so an assignment that violates a type still *runs*. The gate for those
 * cases is `bunx tsc --noEmit` (and `bun run build`, whose `--dts` pass
 * typechecks) — both of which CI already runs. Tests that can fail at runtime
 * are written to do so, because a red test is better evidence than a red
 * compile; tests that cannot are annotated to say so.
 *
 * Keeping this file in sync is manual today. The automated check belongs on
 * the widget side rather than here: this package is public and the widget
 * repo is not, so the comparison can only run where both halves are readable.
 */

/** Minimal valid connection — the three fields that are not optional. */
const baseConnection = {
  publicToken: "public-sandbox-abc123",
  connectionId: "3f8a1c22-0000-4000-8000-000000000001",
  institutionId: "inst_mcb",
} satisfies OmniFIConnection;

describe("OmniFIConnection — fields the widget already sends", () => {
  // COMPILE-TIME. Each of these is an object-literal assignment, so an
  // unknown key is an excess-property error under `tsc --noEmit` even though
  // `bun test` happily runs it.

  test("carries the institution's legal name", () => {
    const connection: OmniFIConnection = {
      ...baseConnection,
      institutionName: "The Mauritius Commercial Bank Ltd",
    };
    expect(connection.institutionName).toBe("The Mauritius Commercial Bank Ltd");
  });

  test("carries the institution's short display name, which is what UI should render", () => {
    // The field that motivated this task: `institutionName` alone cannot tell
    // MCB from MCB Pro, because both tiers share a legal name.
    const connection: OmniFIConnection = {
      ...baseConnection,
      institutionNameShort: "MCB Pro",
    };
    expect(connection.institutionNameShort).toBe("MCB Pro");
  });

  test("carries the multi-profile grouping fields", () => {
    // Absa Pro links N Connections in one session; `connectionGroupId` ties
    // them together and `profileDisplayName` labels each one.
    const connection: OmniFIConnection = {
      ...baseConnection,
      institutionId: "inst_absa_pro",
      connectionGroupId: "9c2e0f55-0000-4000-8000-000000000002",
      profileDisplayName: "Operating Account",
    };
    expect(connection.connectionGroupId).toBeString();
    expect(connection.profileDisplayName).toBe("Operating Account");
  });

  test("a full connection assigns cleanly and reads back without a cast", () => {
    const payload: OmniFISuccessPayload = {
      connections: [
        {
          ...baseConnection,
          institutionName: "The Mauritius Commercial Bank Ltd",
          institutionNameShort: "MCB",
          customerType: "business",
          permittedAccountIds: ["acc_1", "acc_2"],
          connectionGroupId: "9c2e0f55-0000-4000-8000-000000000002",
          profileDisplayName: "Operating Account",
          source: "DOCUMENT_UPLOAD",
        },
      ],
    };

    // The consumer ergonomics this task exists to restore: read the display
    // name off the payload with no `as any` and no `@ts-expect-error`.
    const [first] = payload.connections;
    const label = first?.institutionNameShort ?? first?.institutionName ?? first?.institutionId;
    expect(label).toBe("MCB");
  });
});

describe("OMNIFI_EVENTS — every event the widget posts", () => {
  // RUNTIME. `OMNIFI_EVENTS` is a value, so a missing key is `undefined` here
  // and these fail under `bun test` without needing the compiler.

  test("includes the non-terminal inline-error event", () => {
    // Documented on the public Fern SDK page as the breadcrumb channel for
    // in-place-recoverable failures (wrong password, bad OTP). Consumers can
    // already subscribe by string literal; this makes it a named constant.
    expect(OMNIFI_EVENTS.INLINE_ERROR).toBe("omni-fi:inline-error");
  });

  test("includes the loader's ready acknowledgement", () => {
    expect(OMNIFI_EVENTS.READY_ACK).toBe("omni-fi:ready-ack");
  });

  test("event values are unique", () => {
    const values = Object.values(OMNIFI_EVENTS);
    expect(new Set(values).size).toBe(values.length);
  });

  test("inline-error is assignable to OmniFIEventType", () => {
    // COMPILE-TIME. Passes today only via the `(string & {})` escape hatch on
    // `onEvent`; this pins it to the union proper.
    const event: OmniFIEventType = "omni-fi:inline-error";
    expect(event).toBe(OMNIFI_EVENTS.INLINE_ERROR);
  });
});

describe("OmniFIErrorCode — the terminal codes onError actually receives", () => {
  // COMPILE-TIME. The union shipped only the token/session/institution-config
  // codes; these are the bank-flow failures that reach `onError` in practice.

  const terminalCodes = [
    "AUTH_INVALID_CREDENTIALS",
    "AUTH_ACCOUNT_LOCKED",
    "INVALID_CREDENTIALS",
    "ACCOUNT_LOCKED",
    "LOGIN_FAILED",
    "INSTITUTION_TIMEOUT",
    "INSTITUTION_UNAVAILABLE",
    "ACCOUNT_NOT_FOUND",
    "NETWORK_ERROR",
    "TIMEOUT",
    "TRANSIENT_BANK_ERROR",
    "UI_FLOW_BROKEN",
  ] satisfies OmniFIErrorCode[];

  test("every terminal bank-flow code is part of the union", () => {
    expect(terminalCodes).toHaveLength(12);
  });

  test("the short-form session codes the widget actually posts are in the union", () => {
    // The widget posts `errorType` verbatim, so a host sees the short form —
    // not the `SESSION_TOKEN_*` spelling used by the HTTP API. Both reach
    // `onError` through different routes, so both must be declared.
    const shortSessionCodes = [
      "SESSION_EXPIRED",
      "SESSION_IDLE_EXPIRED",
      "SESSION_REVOKED",
    ] satisfies OmniFIErrorCode[];
    expect(shortSessionCodes).toHaveLength(3);
  });

  test("the widget's own fallback codes are in the union", () => {
    const fallbacks = [
      "GENERIC_ERROR",
      "NO_COMPLETED_CONNECTIONS",
    ] satisfies OmniFIErrorCode[];
    expect(fallbacks).toHaveLength(2);
  });

  test("the documented error-handling example typechecks", () => {
    // Lifted from the Fern `sdk-react-link` page. It did not compile against
    // the shipped union — a copy-pasteable example that fails to typecheck is
    // a poor first impression, so it is pinned here rather than left to the
    // docs to be wrong about.
    function route(code: OmniFIErrorCode): "retry" | "bank" | "generic" {
      switch (code) {
        case "AUTH_INVALID_CREDENTIALS":
        case "AUTH_ACCOUNT_LOCKED":
          return "bank";
        case "INSTITUTION_TIMEOUT":
        case "INSTITUTION_UNAVAILABLE":
        case "NETWORK_ERROR":
          return "retry";
        default:
          return "generic";
      }
    }

    expect(route("AUTH_INVALID_CREDENTIALS")).toBe("bank");
    expect(route("INSTITUTION_UNAVAILABLE")).toBe("retry");
    expect(route("LINK_TOKEN_EXPIRED")).toBe("generic");
  });

  test("the pre-existing API-level codes are still part of the union", () => {
    // Regression guard: widening must not drop what was already there.
    const apiCodes = [
      "LINK_TOKEN_EXPIRED",
      "LINK_TOKEN_INVALID",
      "LINK_TOKEN_USED",
      "PUBLIC_TOKEN_EXPIRED",
      "SESSION_TOKEN_EXPIRED",
      "SESSION_TOKEN_INVALID",
      "INSTITUTION_LOCKED",
      "ORIGIN_NOT_ALLOWED",
      "VALIDATION_ERROR",
    ] satisfies OmniFIErrorCode[];
    expect(apiCodes).toHaveLength(9);
  });
});

describe("onSuccess — the loader/SDK boundary", () => {
  // The one place the SDK is NOT a passthrough, and it has to not be.
  //
  // The loader calls `onSuccess(data.connections)` with the bare array
  // (`packages/link-loader/src/index.ts`), while this SDK's documented API —
  // every example in the README and the hosted docs — is
  // `onSuccess({ connections })`. Something has to adapt, and it is the SDK:
  // the loader's shape is what existing vanilla-JS integrators already rely on,
  // so it cannot change without breaking them.
  //
  // Guarded here rather than only in the hook's own tests, because the failure
  // is silent: a host destructuring `{ connections }` off an array gets
  // `undefined` and simply never sees its connections.

  test("the loader config type declares the ARRAY shape, not the envelope", () => {
    // Compile-time. If `OmniFIWidgetLoaderConfig.onSuccess` ever drifts back to
    // taking the envelope, this stops compiling — which is the point.
    const received: OmniFIConnection[] = [];
    const loaderStyle: OmniFIWidgetLoaderConfig["onSuccess"] = (connections) => {
      received.push(...connections);
    };
    loaderStyle([
      { publicToken: "pt", connectionId: "c", institutionId: "inst_mcb" },
    ]);
    expect(received).toHaveLength(1);
    expect(received[0]?.institutionId).toBe("inst_mcb");
  });

  test("the host-facing config still declares the envelope", () => {
    const seen: string[] = [];
    const hostStyle: OmniFIConfig["onSuccess"] = ({ connections }) => {
      seen.push(...connections.map((c) => c.institutionId));
    };
    hostStyle({
      connections: [
        { publicToken: "pt", connectionId: "c", institutionId: "inst_absa" },
      ],
    });
    expect(seen).toEqual(["inst_absa"]);
  });
});

describe("OmniFIErrorCode — extensible, not exhaustive", () => {
  // The widget posts `errorType` verbatim, and `errorType` can carry any
  // `Error.Type` the BACKEND stamps on a job — including document-pipeline
  // codes that exist only in omni-fi-core and are invisible to this package.
  // Four separate enumerations of "every reachable code" produced four
  // different answers, so the union names what we know without claiming the
  // set is closed. A host's `default:` branch stays reachable, as it must.

  test("an unenumerated backend code is still assignable", () => {
    const fromBackend: OmniFIErrorCode = "DOCUMENT_RECONCILIATION_FAILED";
    expect(fromBackend).toBe("DOCUMENT_RECONCILIATION_FAILED");
  });

  test("known codes still narrow, so autocomplete and comparisons survive", () => {
    const known: OmniFIErrorCode = "AUTH_INVALID_CREDENTIALS";
    expect(known).toBe("AUTH_INVALID_CREDENTIALS");
  });
});

describe("OmniFIInlineErrorPayload — the metadata onEvent actually receives", () => {
  // `emitInlineError.ts` posts code/message/screen/institutionId as top-level
  // fields. Naming the event without naming its payload left consumers casting
  // `Record<string, unknown>` to read `metadata.screen`, which the README tells
  // them to log to analytics.

  test("carries the documented shape", () => {
    const payload: OmniFIInlineErrorPayload = {
      code: "WRONG_OTP_CODE",
      message: "That code did not match.",
      screen: "mfa",
      institutionId: "inst_mcb",
    };
    expect(payload.screen).toBe("mfa");
  });

  test("institutionId is nullable — the user may not have picked a bank yet", () => {
    const payload: OmniFIInlineErrorPayload = {
      code: "VALIDATION_ERROR",
      message: "Something was wrong with that input.",
      screen: "credentials",
      institutionId: null,
    };
    expect(payload.institutionId).toBeNull();
  });
});
