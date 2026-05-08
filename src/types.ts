export const OMNIFI_EVENTS = {
  SUCCESS: "omni-fi:success",
  ERROR: "omni-fi:error",
  EXIT: "omni-fi:exit",
  READY: "omni-fi:ready",
  CONNECTION_LINKED: "omni-fi:connection-linked",
  MFA_REQUIRED: "omni-fi:mfa-required",
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
 * The kind of MFA challenge surfaced by the institution at runtime.
 *
 * - `'sms'` — one-time code sent to a phone number
 * - `'email'` — one-time code sent to an email address
 * - `'totp'` — rolling code from an authenticator app (RFC 6238); rotates every 30s
 *
 * @beta This enum is in beta and may gain additional variants in future releases.
 */
export type OmniFIMfaType = "sms" | "email" | "totp";

/**
 * The recipient kind for the MFA delivery target. Absent for `'totp'`.
 */
export type OmniFIMfaDestinationKind = "email" | "phone";

/**
 * Metadata payload for the {@link OMNIFI_EVENTS.MFA_REQUIRED} event.
 *
 * Forwarded verbatim from the hosted iframe. Consumers can subscribe via
 * `onEvent` and cast `metadata` to this type when `eventName` is
 * {@link OMNIFI_EVENTS.MFA_REQUIRED}.
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
export interface OmniFIMfaRequiredPayload {
  /**
   * The institution this MFA challenge belongs to.
   */
  institutionId: string;
  /**
   * The challenge variant detected at login. Determines what UI the widget
   * surfaces and which fields are populated.
   */
  mfaType: OmniFIMfaType;
  /**
   * Pre-masked recipient string (e.g. `"j***@example.com"`, `"+230 5*** 1234"`).
   * Absent for `mfaType: 'totp'` and may be absent for any institution that
   * has not yet been wired to populate the field.
   */
  mfaDestination?: string;
  /**
   * Recipient kind paired with {@link mfaDestination}. Absent for
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
