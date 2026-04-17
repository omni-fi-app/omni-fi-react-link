export const OMNIFI_EVENTS = {
  SUCCESS: "omni-fi:success",
  ERROR: "omni-fi:error",
  EXIT: "omni-fi:exit",
  READY: "omni-fi:ready",
  SET_THEME: "omni-fi:set-theme",
  SET_LANGUAGE: "omni-fi:set-language",
} as const;

export type OmniFIEventType =
  (typeof OMNIFI_EVENTS)[keyof typeof OMNIFI_EVENTS];

export type OmniFITheme = "light" | "dark" | "system";

export type OmniFILanguage = "en-GB" | "fr";

export interface OmniFIError {
  code: string;
  message: string;
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
  onSuccess: (publicToken: string) => void;
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
