import { describe, expect, test } from "bun:test";
import { getScriptUrl, getLoaderEnvironment } from "./scriptUrl";

/**
 * RED-phase tests for the env → CDN URL lookup.
 *
 * Drives the `OmniFIEnv` type + `getScriptUrl` helper that lets host
 * integrations target staging without hardcoding the URL.
 */
describe("getScriptUrl", () => {
  test("defaults to production CDN when called with no argument", () => {
    expect(getScriptUrl()).toBe(
      "https://cdn.omni-fi.co/v1/omni-fi-connect.js",
    );
  });

  test("returns production CDN for env='production'", () => {
    expect(getScriptUrl("production")).toBe(
      "https://cdn.omni-fi.co/v1/omni-fi-connect.js",
    );
  });

  test("returns staging CDN for env='staging'", () => {
    expect(getScriptUrl("staging")).toBe(
      "https://staging-cdn.omni-fi.co/v1/omni-fi-connect.js",
    );
  });

  test("returns local Vite URL for env='development'", () => {
    expect(getScriptUrl("development")).toBe(
      "http://localhost:5173/omni-fi-connect.js",
    );
  });

  test("includes /v1/ versioning prefix on hosted envs (non-breaking-upgrade path)", () => {
    expect(getScriptUrl("production")).toContain("/v1/");
    expect(getScriptUrl("staging")).toContain("/v1/");
    // Local dev is a single dev server — no versioning prefix needed.
    expect(getScriptUrl("development")).not.toContain("/v1/");
  });

  test("hosted envs use HTTPS; dev uses HTTP localhost", () => {
    expect(getScriptUrl("production").startsWith("https://")).toBe(true);
    expect(getScriptUrl("staging").startsWith("https://")).toBe(true);
    expect(getScriptUrl("development").startsWith("http://localhost")).toBe(
      true,
    );
  });
});

/**
 * RED-phase tests for the env → widget-loader-env mapping.
 *
 * Drives the `getLoaderEnvironment` helper that `useOmniFILink` uses to
 * translate the SDK's `env` field into the `environment` signal the widget
 * loader (`omni-fi-link/packages/link-loader`) reads to pick its iframe
 * origin.
 */
describe("getLoaderEnvironment", () => {
  test("defaults to 'production' when called with no argument", () => {
    expect(getLoaderEnvironment()).toBe("production");
  });

  test("maps 'development' → 'local' (legacy value name)", () => {
    expect(getLoaderEnvironment("development")).toBe("local");
  });

  test("maps 'staging' → 'staging' (verbatim)", () => {
    expect(getLoaderEnvironment("staging")).toBe("staging");
  });

  test("maps 'production' → 'production' (verbatim)", () => {
    expect(getLoaderEnvironment("production")).toBe("production");
  });
});
