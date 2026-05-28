import type { OmniFIEnv } from "../types";

const PRODUCTION_SCRIPT_URL = "https://cdn.omni-fi.co/v1/omni-fi-connect.js";
const STAGING_SCRIPT_URL =
  "https://staging-cdn.omni-fi.co/v1/omni-fi-connect.js";
const DEVELOPMENT_SCRIPT_URL = "http://localhost:5173/omni-fi-connect.js";

/**
 * Map an {@link OmniFIEnv} value to the CDN URL the SDK should fetch the
 * loader script from. Pure function — no side effects, no caching.
 *
 * The hosted environments use a `/v1/` versioning prefix so a future v2 can
 * ship at `/v2/omni-fi-connect.js` without breaking integrations pinned to
 * v1. The development URL targets a local Vite dev server on port 5173.
 *
 * Consumers normally don't need to call this directly — `useOmniFILink`
 * resolves the URL internally from `OmniFIConfig.env`. It's exported for
 * debugging and for tests that need to assert on the URL shape.
 */
export const getScriptUrl = (env: OmniFIEnv = "production"): string => {
  switch (env) {
    case "development":
      return DEVELOPMENT_SCRIPT_URL;
    case "staging":
      return STAGING_SCRIPT_URL;
    case "production":
    default:
      return PRODUCTION_SCRIPT_URL;
  }
};

/**
 * Map an {@link OmniFIEnv} value to the env signal the widget loader
 * (`omni-fi-link/packages/link-loader`) reads from its config payload.
 *
 * The loader's `getBaseUrl()` switches on `"local" | "staging" | "production"`
 * to pick the iframe origin; `"development"` (idiomatic) maps to `"local"`
 * (loader's existing value). `useOmniFILink` calls this internally when
 * forwarding the config to `window.OmniFI.connect()` so the loader sees the
 * same env signal the SDK used for the CDN URL.
 *
 * Pure function. Exhaustive switch with a safety default.
 */
export const getLoaderEnvironment = (
  env: OmniFIEnv = "production",
): "local" | "staging" | "production" => {
  switch (env) {
    case "development":
      return "local";
    case "staging":
      return "staging";
    case "production":
    default:
      return "production";
  }
};
