import { describe, expect, test } from "bun:test";
import {
  OMNIFI_EVENTS,
  type OmniFIConnection,
  type OmniFIErrorCode,
  type OmniFIEventType,
  type OmniFISuccessPayload,
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
    "NETWORK_ERROR",
    "TIMEOUT",
    "TRANSIENT_BANK_ERROR",
    "UI_FLOW_BROKEN",
  ] satisfies OmniFIErrorCode[];

  test("every terminal bank-flow code is part of the union", () => {
    expect(terminalCodes).toHaveLength(11);
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
