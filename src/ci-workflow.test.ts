/**
 * ci-workflow.test.ts — invariants of the `CI` workflow that nothing else checks.
 *
 * Reads `.github/workflows/ci.yml` as PLAIN TEXT rather than through a YAML
 * parser, following omni-fi-core's `TestCIFernGate`: the only YAML parser
 * reachable here is a transitive dependency of another tool, and a guard that
 * silently stops running when its parser goes missing reproduces the class of
 * failure it exists to prevent.
 *
 * The invariant: the `CI` job must bound its own runtime. GitHub's default is
 * 360 minutes. That was theoretical while CI was lint + build + unit tests, all
 * of which fail fast. It stopped being theoretical when the job gained a browser
 * suite (task 7.50): a hung page is now the most likely way this workflow stops
 * making progress, `playwright.config.ts` sets `retries: 0` so nothing shakes it
 * loose, and the check blocks every merge to `staging`. Six hours of a runner,
 * and six hours of a blocked queue.
 *
 * `concurrency.cancel-in-progress` bounds this for a branch someone pushes to
 * again. It does nothing for a PR that is opened and left.
 */

import { describe, expect, test } from "bun:test";

const WORKFLOWS_DIR = `${import.meta.dir}/../.github/workflows`;
const WORKFLOW_PATH = `${WORKFLOWS_DIR}/ci.yml`;

/** Job keys in a workflow: two-space-indented `name:` lines under `jobs:`. */
function jobsWithoutTimeout(yaml: string): string[] {
  const lines = yaml.split("\n");
  const start = lines.findIndex((l) => /^jobs:/.test(l));
  if (start < 0) return [];
  const missing: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const job = lines[i].match(/^ {2}([A-Za-z0-9_-]+):\s*$/);
    if (!job) continue;
    // Scan this job's own keys (4-space indent) until the next job starts.
    let bounded = false;
    for (let j = i + 1; j < lines.length && !/^ {2}[A-Za-z0-9_-]+:\s*$/.test(lines[j]); j++) {
      if (/^ {4}timeout-minutes:\s*\d+\s*(?:#.*)?$/.test(lines[j])) { bounded = true; break; }
    }
    if (!bounded) missing.push(job[1]);
  }
  return missing;
}

/** GitHub's default job timeout, in minutes — the value we must not inherit. */
const GITHUB_DEFAULT_TIMEOUT_MINUTES = 360;

// Trailing comments are legal and used in this repo (claude-code-review.yml
// writes `timeout-minutes: 30   # true backstop`). Requiring end-of-line after
// the digits reports a declared timeout as absent — a false FAILURE.
const TIMEOUT_DECLARATION = /^\s*timeout-minutes:\s*(\d+)\s*(?:#.*)?$/m;

const PACKAGE_JSON_PATH = `${import.meta.dir}/../package.json`;

/** `1.3.14` -> `1.3`. Patch drift is tolerated; a minor bump is not. */
const minorOf = (version: string) => version.split(".").slice(0, 2).join(".");

describe("CI workflow", () => {
  test("the CI job declares a timeout-minutes", async () => {
    const raw = await Bun.file(WORKFLOW_PATH).text();

    expect(
      raw.match(TIMEOUT_DECLARATION),
      "the CI job must set timeout-minutes — a hung browser test would otherwise " +
        `hold a runner, and block the merge queue, for GitHub's default ` +
        `${GITHUB_DEFAULT_TIMEOUT_MINUTES} minutes`,
    ).not.toBeNull();
  });

  test("the timeout is short enough to be worth having", async () => {
    const raw = await Bun.file(WORKFLOW_PATH).text();
    const minutes = Number(raw.match(TIMEOUT_DECLARATION)?.[1]);

    // A generous multiple of the ~3 minutes this job actually takes, and far
    // below the default it replaces. A timeout near the default is the same
    // problem with extra steps.
    expect(minutes).toBeGreaterThan(0);
    expect(minutes).toBeLessThan(GITHUB_DEFAULT_TIMEOUT_MINUTES / 4);
  });

  /**
   * Bun does not enforce its own version pin. Measured on 1.3.14: with
   * `packageManager: "bun@1.0.0"` AND a `.bun-version` of 1.0.0, `bun --version`
   * still reports the installed build and `bun install` says nothing. Unlike
   * Corepack for npm/yarn/pnpm, and unlike `uv` reading `.python-version`,
   * nothing in the toolchain closes this loop — so the declaration binds CI, and
   * these tests are what make it mean anything locally.
   *
   * `packageManager` rather than `.bun-version` because omni-fi-link and
   * omni-fi-react-link already declare it, and link's deploy.yml already
   * installs from it. Neither file is honoured by bun itself, so consistency
   * with what exists decides it.
   */
  test("the bun version has a single source of truth", async () => {
    const raw = await Bun.file(WORKFLOW_PATH).text();
    const pkg = await Bun.file(PACKAGE_JSON_PATH).json();

    expect(
      pkg.packageManager,
      "package.json must declare packageManager: bun@<version> — the org convention",
    ).toMatch(/^bun@\d+\.\d+\.\d+$/);

    // A literal `bun-version:` in the workflow is a SECOND source of truth, and
    // the sticky one: CI keeps installing it long after the repo moves on.
    expect(
      raw.match(/^\s*bun-version:\s*\S/m),
      "ci.yml must not hardcode bun-version — use bun-version-file: package.json",
    ).toBeNull();
    expect(
      raw.match(/^\s*bun-version-file:\s*package\.json\s*$/m),
      "ci.yml must install bun from package.json",
    ).not.toBeNull();
  });

  test("the pinned bun MINOR matches the bun running this suite", async () => {
    const pkg = await Bun.file(PACKAGE_JSON_PATH).json();
    const pinned = String(pkg.packageManager).replace(/^bun@/, "");

    // Minor, not exact. The drift this task came from (#16) was filesystem
    // enumeration order, not a bun release — so failing a developer's whole
    // suite over a patch difference costs more than the risk it covers, and
    // unlike uv this test cannot install the right version for them. A MINOR
    // bump is a different story: that is where bun changes behaviour.
    expect(
      minorOf(pinned),
      `package.json pins bun@${pinned} but this suite is running on ` +
        `${Bun.version}. Patch drift is fine; a minor difference is not — ` +
        `either \`bun upgrade --to ${pinned}\`, or move the pin deliberately.`,
    ).toBe(minorOf(Bun.version));
  });

  test("EVERY job in EVERY workflow bounds its own runtime", async () => {
    // Generalised from the CI job after the omni-fi-link#101 bot review pointed
    // out that deploy.yml was unbounded for the same reason — a stuck S3 sync or
    // a stalled CloudFront invalidation outlasts a stuck test suite easily, and
    // deploy runs on push to staging. Asserting the whole directory means the
    // next workflow added cannot quietly reintroduce the 360-minute default.
    const { readdirSync } = await import("node:fs");
    const offenders: string[] = [];

    for (const file of readdirSync(WORKFLOWS_DIR).filter((f) => f.endsWith(".yml"))) {
      const yaml = await Bun.file(`${WORKFLOWS_DIR}/${file}`).text();
      for (const job of jobsWithoutTimeout(yaml)) offenders.push(`${file}:${job}`);
    }

    expect(
      offenders,
      "these jobs inherit GitHub's 360-minute default — add timeout-minutes",
    ).toEqual([]);
  });

  test("a trailing comment on the declaration still counts as bounded", () => {
    // Regression guard for a bug in this file's own parser: requiring the line
    // to END at the digits reported `timeout-minutes: 30   # note` as missing,
    // which claude-code-review.yml has written since it was added.
    expect(
      jobsWithoutTimeout("jobs:\n  a:\n    timeout-minutes: 30   # backstop\n"),
    ).toEqual([]);
    expect(jobsWithoutTimeout("jobs:\n  a:\n    runs-on: x\n")).toEqual(["a"]);
  });
});
