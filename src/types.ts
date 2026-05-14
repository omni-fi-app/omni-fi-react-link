// Strictly typed events the hosted widget emits via postMessage.
// Order and keys mirror `packages/shared/src/index.ts` in omni-fi-link verbatim.
export const OMNIFI_EVENTS = {
  SUCCESS: "omni-fi:success",
  ERROR: "omni-fi:error",
  EXIT: "omni-fi:exit",
  READY: "omni-fi:ready",
  SET_THEME: "omni-fi:set-theme",
  SET_LANGUAGE: "omni-fi:set-language",
  CONNECTION_LINKED: "omni-fi:connection-linked",
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
  /**
   * Optional — the widget can emit the `connection-linked` event before
   * `customerType` is resolved. Matches `OmniFILinkedConnection.customerType`
   * in `omni-fi-link/packages/shared`.
   */
  customerType?: "personal" | "business";
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
 * Canonical lowercase MFA challenge types returned by the connect/sync engine.
 * Mirrors `OmniFIMfaType` in `omni-fi-link/packages/shared`.
 *
 * The hosted widget handles the MFA challenge internally today and does **not**
 * surface a typed `mfa-challenge` event to SDK consumers. This union is
 * re-exported for forward compatibility and for consumers that read the
 * institution-level field directly from the API.
 *
 * @beta This union is in beta and may gain additional variants in future releases.
 */
export type OmniFIMfaType = "sms" | "email" | "totp" | "none";

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
   * omit fields the types declare as required. Pin the SDK to a matching
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
