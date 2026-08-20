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
  /**
   * Non-terminal. The user hit something they can recover from in place —
   * a wrong password, a bad OTP, a rejected account — and is still in the
   * flow. Log it as a breadcrumb; do not treat the session as over. That is
   * what separates it from `ERROR`, which is terminal.
   */
  INLINE_ERROR: "omni-fi:inline-error",
  /**
   * Loader-level handshake: the widget acknowledging the host's `READY`.
   * Consumers rarely need it, but it is part of the postMessage vocabulary
   * and `onEvent` receives it, so it is named here rather than reaching a
   * host as an unrecognised string.
   */
  READY_ACK: "omni-fi:ready-ack",
} as const;

export type OmniFIEventType =
  (typeof OMNIFI_EVENTS)[keyof typeof OMNIFI_EVENTS];

export type OmniFITheme = "light" | "dark" | "system";

export type OmniFILanguage = "en-GB" | "fr";

/**
 * Deployment environment the SDK should target. Switches the CDN URL the
 * loader script is fetched from, so host integrations don't have to
 * hardcode the staging URL.
 *
 * - `"production"` (default) — `cdn.omni-fi.co/v1/omni-fi-connect.js`
 * - `"staging"` — `staging-cdn.omni-fi.co/v1/omni-fi-connect.js`
 * - `"development"` — `http://localhost:5173/omni-fi-connect.js` (expects a
 *   local Vite dev server serving the widget bundle)
 *
 * For advanced version-pinning (e.g. `/v2/`) or self-hosting, the
 * `scriptUrl` override on {@link OmniFIConfig} takes precedence.
 */
export type OmniFIEnv = "development" | "staging" | "production";

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
  // Terminal bank-flow failures. Everything above is the API rejecting the
  // request; these are the widget giving up mid-flow, and in practice they
  // are the codes `onError` receives most often. `INVALID_CREDENTIALS` and
  // `ACCOUNT_LOCKED` are the unprefixed forms some institutions still emit —
  // both spellings reach hosts, so both are declared rather than silently
  // failing a consumer's exhaustive switch.
  | "AUTH_INVALID_CREDENTIALS"
  | "AUTH_ACCOUNT_LOCKED"
  | "INVALID_CREDENTIALS"
  | "ACCOUNT_LOCKED"
  | "LOGIN_FAILED"
  | "INSTITUTION_TIMEOUT"
  | "INSTITUTION_UNAVAILABLE"
  | "NETWORK_ERROR"
  | "TIMEOUT"
  | "TRANSIENT_BANK_ERROR"
  | "UI_FLOW_BROKEN"
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
   * How this connection's data was sourced.
   *
   * - `"DOCUMENT_UPLOAD"` — the end-user uploaded bank statements; the
   *   connection is credential-less and its accounts/transactions come from the
   *   parsed documents.
   * - **absent** — the connection was established via the standard bank-login
   *   (scrape) flow. The field is only emitted for document-upload connections,
   *   so `source === undefined` is the implicit login/scrape case.
   *
   * Use this to discriminate uploaded vs logged-in connections in a mixed-mode
   * session (a single `onSuccess` payload can contain both). Mirrors
   * `OmniFILinkedConnection.source` in `omni-fi-link/packages/shared` (the wire
   * contract); the union may gain variants in future releases, so treat any
   * non-`"DOCUMENT_UPLOAD"` / absent value as login.
   */
  source?: "DOCUMENT_UPLOAD";
  /**
   * Account IDs the end-user explicitly permitted the client to access.
   * Present for B2C flows where the user selects accounts in the widget.
   * Undefined for B2B flows where all accounts are auto-confirmed. Document-upload
   * connections auto-confirm their accounts (the upload is the consent), so this
   * is typically undefined for `source: "DOCUMENT_UPLOAD"`.
   */
  permittedAccountIds?: string[];
  /**
   * The institution's full legal name (e.g. `"The Mauritius Commercial Bank
   * Ltd"`). Mirrors `OmniFILinkedConnection.institutionName` in
   * `omni-fi-link/packages/shared`.
   *
   * Prefer `institutionNameShort` for anything user-facing — see below.
   */
  institutionName?: string;
  /**
   * The institution's short display name (e.g. `"MCB"`, `"MCB Pro"`). This is
   * the one to render.
   *
   * `institutionName` cannot be used to tell a bank's personal and business
   * tiers apart, because both tiers share one legal name — two rows labelled
   * from it are indistinguishable. The short name is what carries the
   * distinction.
   *
   * Optional because older widget builds did not send it; fall back to
   * `institutionName`, then `institutionId`.
   */
  institutionNameShort?: string;
  /**
   * Multi-profile institutions only (Absa Pro). One login can expose several
   * banking profiles, each of which becomes its own `Connection`; this UUID
   * ties that set together so a host can group them under one heading rather
   * than listing N apparently unrelated banks.
   *
   * Undefined for single-profile flows.
   */
  connectionGroupId?: string;
  /**
   * Multi-profile institutions only — the bank's own label for this profile
   * (e.g. `"Operating Account"`), so grouped rows can be told apart.
   *
   * Undefined for single-profile flows.
   */
  profileDisplayName?: string;
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
  theme?: OmniFITheme;
  language?: OmniFILanguage;
  /**
   * Deployment environment the SDK should target. Single source of truth
   * for env signalling — drives both the CDN URL the loader script is
   * fetched from AND the `environment` value the widget iframe runtime
   * receives via `window.OmniFI.connect()`. Defaults to `"production"`.
   *
   * Use this in preference to `scriptUrl` — host integrations targeting
   * staging only need to set `env: "staging"` rather than hardcoding the URL.
   *
   * **Locked at mount.** The loader script URL is resolved once on first
   * mount; subsequent rerenders that change `env` are ignored (with a
   * `console.warn` in development builds). Mount the hook on a new key if
   * you need to switch environments at runtime — this guarantees the
   * loaded script and the iframe runtime env can't disagree.
   *
   * **Precedence with `scriptUrl`.** When both are set, `scriptUrl` wins
   * for the loader script URL only. `env` still drives the iframe's
   * `environment` runtime signal — see the `scriptUrl` docs.
   */
  env?: OmniFIEnv;
  /**
   * Override the CDN URL for the Omni-FI Connect script.
   * Advanced usage: for pinning to a specific hosted version (e.g.
   * `/v2/omni-fi-connect.js` once v2 ships) or for self-hosting under
   * exceptional circumstances. Prefer the `env` field for normal
   * production / staging / development switching.
   *
   * **URL-only precedence.** When both `env` and `scriptUrl` are set,
   * `scriptUrl` wins for the **loader script URL only** — the
   * `environment` value passed to `window.OmniFI.connect()` is still
   * derived from `env` and defaults to `"production"`. A consumer who
   * sets a custom staging / development `scriptUrl` MUST also set the
   * matching `env`; otherwise the loaded script and the widget iframe
   * origin can diverge (e.g. staging script loaded but the iframe still
   * runs in production mode).
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

/**
 * Shape of the config payload the widget loader
 * (`omni-fi-link/packages/link-loader`) actually consumes. The loader reads
 * `environment` (values: `"local" | "staging" | "production"`) to pick its
 * iframe origin. `useOmniFILink` derives this from the SDK's public `env`
 * field via `getLoaderEnvironment` and passes the augmented object to
 * `window.OmniFI.connect()`.
 *
 * Module-local — not part of the SDK's public consumer-facing surface.
 */
interface WidgetLoaderConfig extends OmniFIConfig {
  environment: "local" | "staging" | "production";
}

// Extend the global Window object so TypeScript knows about our injected script
declare global {
  interface Window {
    OmniFI?: {
      connect: (options: WidgetLoaderConfig) => OmniFIInstance;
    };
  }
}
