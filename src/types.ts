export const OMNIFI_EVENTS = {
  SUCCESS: "omni-fi:success",
  ERROR: "omni-fi:error",
  EXIT: "omni-fi:exit",
  READY: "omni-fi:ready",
  CONNECTION_LINKED: "omni-fi:connection-linked",
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
}

export interface OmniFISuccessPayload {
  connections: OmniFIConnection[];
}

export type OmniFIConnectionLinkedPayload = OmniFIConnection;

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
