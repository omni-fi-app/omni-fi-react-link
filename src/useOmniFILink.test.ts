import { describe, test, beforeAll, afterAll } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

describe("useOmniFILink Hook", () => {
  beforeAll(() => {
    GlobalRegistrator.register();
  });

  afterAll(() => {
    GlobalRegistrator.unregister();
  });

  test.todo("initializes with isReady false", () => {});
  test.todo("sets isReady true after script loads", () => {});
  test.todo("does not inject duplicate script tags on re-render", () => {});
});
