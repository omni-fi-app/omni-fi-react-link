export const OMNIFI_EVENTS = {
  SUCCESS: "omni-fi:success",
  ERROR: "omni-fi:error",
  EXIT: "omni-fi:exit",
  READY: "omni-fi:ready",
  CONNECTION_LINKED: "omni-fi:connection-linked",
  MFA_CHALLENGE: "omni-fi:mfa-challenge",
  SET_THEME: "omni-fi:set-theme",
  SET_LANGUAGE: "omni-fi:set-language",
} as const;

export type OmniFIEventType =
  (typeof OMNIFI_EVENTS)[keyof typeof OMNIFI_EVENTS];

export type OmniFITheme = "light" | "dark" | "system";

export type OmniFILanguage = "en-GB" | "fr";

export type OmniFIErrorCode =
  // LinkToken errors
  | "LINK_TOKEN_INVALID"
  | "LINK_TOKEN_EXPIRED"
  | "LINK_TOKEN_USED"
  // SessionToken errors
  | "SESSION_TOKEN_INVALID"
  | "SESSION_TOKEN_REVOKED"
  | "SESSION_TOKEN_EXPIRED"
  | "SESSION_TOKEN_IDLE_EXPIRED"
  // PublicToken exchange errors
  | "PUBLIC_TOKEN_INVALID"
  | "PUBLIC_TOKEN_USED"
  | "PUBLIC_TOKEN_EXPIRED"
  | "PUBLIC_TOKEN_CLIENT_MISMATCH"
  // Institution errors
  | "INSTITUTION_LOCKED"
  | "INSTITUTION_NOT_FOUND"
  | "INSTITUTION_REQUIRED"
  | "INSTITUTION_SANDBOX_ONLY"
  // Credential / session errors
  | "SANDBOX_CREDENTIALS_REQUIRED"
  | "ORIGIN_NOT_ALLOWED"
  // Generic
  | "VALIDATION_ERROR";

export interface OmniFIError {
  code: OmniFIErrorCode;
  message: string;
}

export interface OmniFIConnection {
  publicToken: string;
  /**
   * UUID of the persisted Connection record on the Omni-FI backend.
   *
   * Use this to call connection-scoped endpoints
   * (`PUT /connections/{id}/accounts`, `GET /connections/{id}/accounts`,
   * `DELETE /connections/{id}`) without needing to exchange the
   * `publicToken` first.
   *
   * Surfaced on every connection record — both the per-bank
   * `omni-fi:connection-linked` event and the final `onSuccess` payload —
   * so a host backend that loses the user mid-flow (e.g. browser closed
   * after link-connect but before Account-Select Continue) can still
   * address the persisted connection.
   */
  connectionId: string;
  institutionId: string;
  customerType: "personal" | "business";
  /**
   * Account IDs the end-user explicitly permitted the client to access.
   * Present for B2C flows where the user selects accounts in the widget.
   * Undefined for B2B flows where all accounts are auto-confirmed.
   */
  permittedAccountIds?: string[];
}

export interface OmniFISuccessPayload {
  connections: OmniFIConnection[];
}

export type OmniFIConnectionLinkedPayload = OmniFIConnection;

/**
 * The institution-level MFA mode.
 *
 * - `'none'` — institution does not require MFA.
 * - `'sms'` — one-time code sent to a phone number.
 * - `'email'` — one-time code sent to an email address.
 * - `'totp'` — rolling code from an authenticator app (RFC 6238); rotates every 30s.
 *
 * **Single source of truth.** "Is MFA required?" is `mfaType !== 'none'`.
 * There is intentionally no separate boolean — a redundant flag would drift
 * from `mfaType` and is not part of the Omni-FI contract.
 *
 * The {@link OmniFIMfaChallengePayload} on the `omni-fi:mfa-challenge` event
 * narrows this to {@link OmniFIMfaChallengeType} (excludes `'none'`) because
 * the event only fires when MFA is actually required.
 *
 * @beta This union is in beta and may gain additional variants in future releases.
 */
export type OmniFIMfaType = "none" | "sms" | "email" | "totp";

/**
 * The MFA variants that can appear on an `omni-fi:mfa-challenge` event —
 * {@link OmniFIMfaType} narrowed to exclude `'none'`. The event does not fire
 * for institutions whose `mfaType` is `'none'`, so consumers handling this
 * event do not need to guard against it.
 */
export type OmniFIMfaChallengeType = Exclude<OmniFIMfaType, "none">;

/**
 * The recipient kind for the MFA delivery target. Absent for `'totp'`.
 */
export type OmniFIMfaDestinationKind = "email" | "phone";

/**
 * Metadata payload for the {@link OMNIFI_EVENTS.MFA_CHALLENGE} event.
 *
 * Forwarded verbatim from the hosted iframe. Consumers can subscribe via
 * `onEvent` and cast `metadata` to this type when `eventName` is
 * {@link OMNIFI_EVENTS.MFA_CHALLENGE}.
 *
 * The `mfaDestination` / `mfaDestinationKind` / `mfaLength` fields are the
 * camelCase wrappers around the backend's `delivery_target` / `delivery_kind`
 * / `mfa_length` fields. The destination string is **always pre-masked at
 * source** (e.g. `"j***@example.com"`, `"+230 5*** 1234"`) and should be
 * treated as opaque — the SDK does not parse, validate, or alter it.
 *
 * For `mfaType === 'totp'` the destination fields are absent; codes come from
 * an authenticator app and rotate every 30 seconds.
 *
 * @beta These fields are in beta per upstream Fern availability.
 */
export interface OmniFIMfaChallengePayload {
  /**
   * The institution this MFA challenge belongs to.
   */
  institutionId: string;
  /**
   * The challenge variant detected at login. Determines what UI the widget
   * surfaces and which fields are populated. Narrowed to exclude `'none'`
   * because the event only fires when MFA is actually required.
   */
  mfaType: OmniFIMfaChallengeType;
  /**
   * Pre-masked recipient string (e.g. `"j***@example.com"`, `"+230 5*** 1234"`).
   * Absent for `mfaType: 'totp'` and may be absent for any institution that
   * has not yet been wired to populate the field.
   */
  mfaDestination?: string;
  /**
   * Recipient kind paired with `mfaDestination`. Absent for
   * `mfaType: 'totp'`.
   */
  mfaDestinationKind?: OmniFIMfaDestinationKind;
  /**
   * Expected digit count for the OTP. Defaults are caller-chosen when absent
   * (typically 4 for `sms`/`email`, 6 for `totp`).
   */
  mfaLength?: number;
}

export interface OmniFIConfig {
  token: string;
  containerId?: string;
  displayMode?: "iframe" | "popup";
  environment?: "local" | "staging" | "production";
  theme?: OmniFITheme;
  language?: OmniFILanguage;
  /**
   * Override the CDN URL for the Omni-FI Connect script.
   * Useful for enterprise clients that need to pin to a specific hosted version.
   * If omitted, the SDK loads the latest version from the default CDN.
   *
   * **Widget / SDK version coupling.** This SDK's TypeScript types describe
   * the contract emitted by the **current** widget release. Pinning
   * `scriptUrl` to an older widget version may cause runtime payloads to
   * omit fields the types declare as required (for example, older widgets
   * predate `OmniFIConnection.connectionId`). Pin the SDK to a matching
   * version when pinning the widget — or stay on `latest` for both.
   */
  scriptUrl?: string;
  onSuccess: (payload: OmniFISuccessPayload) => void;
  onError?: (error: OmniFIError) => void;
  onExit?: () => void;
  onEvent?: (
    eventName: OmniFIEventType | (string & {}),
    metadata?: Record<string, unknown>,
  ) => void;
}

export interface OmniFIInstance {
  destroy: () => void;
  setTheme: (theme: OmniFITheme) => void;
  setLanguage: (lang: OmniFILanguage) => void;
}

// Extend the global Window object so TypeScript knows about our injected script
declare global {
  interface Window {
    OmniFI?: {
      connect: (options: OmniFIConfig) => OmniFIInstance;
    };
  }
}
