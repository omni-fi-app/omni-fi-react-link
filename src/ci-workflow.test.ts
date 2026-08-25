/**
 * ci-workflow.test.ts — invariants of the workflows that nothing else checks.
 *
 * Reads `.github/workflows/*.yml` as PLAIN TEXT rather than through a YAML
 * parser, following omni-fi-core's `TestCIFernGate`: the only YAML parser
 * reachable here is a transitive dependency of another tool, and a guard that
 * silently stops running when its parser goes missing reproduces the class of
 * failure it exists to prevent.
 *
 * The invariant: every job must bound its own runtime. GitHub's default is 360
 * minutes. The stakes are lower here than in omni-fi-web, which is where this
 * guard originated (task 7.50) — that repo's CI gained a Playwright suite, and a
 * hung browser is a far likelier way for a job to stop making progress than
 * anything in this one, which is lint + build + test and fails fast. This repo
 * has no browser suite and no deploy workflow at all.
 *
 * It is here anyway because `CI` is the required status check, so a hung job
 * holds the merge as well as the runner, and because the guard is what stops the
 * NEXT workflow added here from quietly inheriting the default.
 *
 * `concurrency.cancel-in-progress` bounds this for a branch someone pushes to
 * again. It does nothing for a PR that is opened and left.
 */

import { describe, expect, test } from "bun:test";

const WORKFLOWS_DIR = `${import.meta.dir}/../.github/workflows`;
const WORKFLOW_PATH = `${WORKFLOWS_DIR}/ci.yml`;

/**
 * A workflow file. GitHub accepts both extensions, so a sweep that reads only
 * one leaves a hole the shape of whichever file someone names `.yaml`.
 */
const WORKFLOW_FILE = /\.ya?ml$/;

/**
 * A job header: two-space key, optionally followed by a comment. The trailing
 * comment matters twice over — without it a commented key is skipped, AND the
 * inner scan below fails to stop at it and borrows the next job's timeout,
 * reporting an unbounded job as bounded. One constant so the two uses cannot
 * drift apart again.
 */
const JOB_HEADER = /^ {2}([A-Za-z0-9_-]+):\s*(?:#.*)?$/;

/**
 * A job's own `timeout-minutes`: four-space indent, optionally followed by a
 * comment. Trailing comments are legal YAML and omni-fi-web's
 * claude-code-review.yml writes `timeout-minutes: 30   # true backstop` —
 * requiring end-of-line after the digits reports a declared timeout as absent,
 * which is a false FAILURE.
 */
const JOB_TIMEOUT = /^ {4}timeout-minutes:\s*(\d+)\s*(?:#.*)?$/;

/**
 * Every job under `jobs:`, mapped to the timeout it declares — `null` where it
 * declares none. One scan, three callers. Asking for a NAMED job's bound is
 * what stops an assertion from matching the first `timeout-minutes` anywhere in
 * the file and reporting a neighbouring job's value as this one's.
 */
function jobTimeouts(yaml: string): Map<string, number | null> {
  // `/\r?\n/`, not `"\n"`: no .gitattributes normalises line endings in this
  // repo, so a Windows checkout is CRLF and every line would arrive with a
  // trailing `\r`. `\s` matches CR but `.` does not, so `(?:#.*)?$` would fail
  // on exactly the COMMENTED lines the trailing-comment tolerance exists for —
  // taking JOB_HEADER with it, and with it the borrow defect. Pinned below.
  const lines = yaml.split(/\r?\n/);
  const timeouts = new Map<string, number | null>();
  const start = lines.findIndex((l) => /^jobs:/.test(l));
  if (start < 0) return timeouts;
  for (let i = start + 1; i < lines.length; i++) {
    const job = lines[i].match(JOB_HEADER);
    if (!job) continue;
    // Scan this job's own keys (4-space indent) until the next job starts.
    let minutes: number | null = null;
    for (let j = i + 1; j < lines.length && !JOB_HEADER.test(lines[j]); j++) {
      const declared = lines[j].match(JOB_TIMEOUT);
      if (declared) { minutes = Number(declared[1]); break; }
    }
    timeouts.set(job[1], minutes);
  }
  return timeouts;
}

/** Job keys under `jobs:` that declare no `timeout-minutes` of their own. */
const jobsWithoutTimeout = (yaml: string): string[] =>
  [...jobTimeouts(yaml)].filter(([, minutes]) => minutes === null).map(([job]) => job);

/** Every workflow in the directory, as `[filename, text]`. */
async function workflows(): Promise<[string, string][]> {
  const { readdirSync } = await import("node:fs");
  const files = readdirSync(WORKFLOWS_DIR).filter((f) => WORKFLOW_FILE.test(f));
  return Promise.all(
    files.map(async (f) => [f, await Bun.file(`${WORKFLOWS_DIR}/${f}`).text()] as [string, string]),
  );
}

/** GitHub's default job timeout, in minutes — the value we must not inherit. */
const GITHUB_DEFAULT_TIMEOUT_MINUTES = 360;


/** The install line ci.yml must carry. Comment-tolerant for JOB_TIMEOUT's reason. */
const BUN_VERSION_FILE = /^\s*bun-version-file:\s*package\.json\s*(?:#.*)?$/m;

const PACKAGE_JSON_PATH = `${import.meta.dir}/../package.json`;

/** `1.3.14` -> `1.3`. Patch drift is tolerated; a minor bump is not. */
const minorOf = (version: string) => version.split(".").slice(0, 2).join(".");


/**
 * One git invocation, or `null` when git cannot answer.
 *
 * `null` covers both "git is not installed" and "this is not a checkout" — a
 * tarball, or a Docker `COPY` that omitted `.git`. Neither is a working tree
 * anyone can fix, so the caller skips rather than failing a build over it.
 */
const git = (args: string[]): string | null => {
  try {
    const run = Bun.spawnSync(["git", ...args], { stdout: "pipe", stderr: "pipe" });
    return run.exitCode === 0 ? run.stdout.toString().trim() : null;
  } catch {
    return null;
  }
};

/**
 * This checkout's root, or `null` when git cannot answer — no git installed, or
 * no `.git` at all (a tarball, a Docker `COPY` that omitted it).
 *
 * Resolved at MODULE scope so the line-endings test can be DECLARED
 * conditionally. `test.if(...)` records a real SKIP; a runtime `return` records
 * a PASS indistinguishable from "ran, and the tree is clean" — and a guard that
 * reports green without running is the exact failure that test was rewritten to
 * escape. `Bun.spawnSync` is synchronous, so the answer exists in time.
 */
const GIT_ROOT = git(["-C", import.meta.dir, "rev-parse", "--show-toplevel"]);

if (GIT_ROOT === null) {
  // The SKIP says it did not run; this says why.
  console.warn(
    "[line endings] not a git checkout — this working tree was not inspected.",
  );
}

describe("CI workflow", () => {
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
      raw.match(BUN_VERSION_FILE),
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
    const offenders: string[] = [];
    for (const [file, yaml] of await workflows()) {
      for (const job of jobsWithoutTimeout(yaml)) offenders.push(`${file}:${job}`);
    }

    expect(
      offenders,
      "these jobs inherit GitHub's 360-minute default — add timeout-minutes",
    ).toEqual([]);
  });

  test("EVERY declared bound is short enough to be worth having", async () => {
    // Replaces two CI-job-specific tests that read the FIRST `timeout-minutes`
    // anywhere in ci.yml, so a neighbouring job's value could satisfy them. Every
    // job, per job, from the same parser — strictly stronger than what it
    // replaces, and there is no longer a single-job call site to regress.
    const tooLong: string[] = [];
    for (const [file, yaml] of await workflows()) {
      for (const [job, minutes] of jobTimeouts(yaml)) {
        if (minutes !== null && minutes >= GITHUB_DEFAULT_TIMEOUT_MINUTES / 4) {
          tooLong.push(`${file}:${job}=${minutes}`);
        }
      }
    }

    expect(
      tooLong,
      "a timeout near GitHub's default is the same problem with extra steps",
    ).toEqual([]);
  });

  test("a job's timeout is read from ITS OWN block, not from the file", () => {
    // The two assertions above used to match the first `timeout-minutes`
    // ANYWHERE in ci.yml. With one job that is harmless; a second job declared
    // ahead of CI lends CI its bound, and both tests go green on a CI job that
    // declares nothing. Measured: with `lint: timeout-minutes: 5` inserted
    // above an unbounded CI, both passed. (The every-job sweep still failed, so
    // the suite caught it — but these two tests did not enforce what they name.)
    const twoJobs =
      "jobs:\n  lint:\n    timeout-minutes: 5\n    runs-on: x\n  CI:\n    runs-on: x\n";
    expect(jobTimeouts(twoJobs).get("lint")).toBe(5);
    expect(jobTimeouts(twoJobs).get("CI")).toBeNull();
  });

  test("a trailing comment on the bun install line is tolerated", () => {
    // Same class as JOB_TIMEOUT, in the assertion rather than the parser: a
    // bare `$` here turns `bun-version-file: package.json # from packageManager`
    // into a false FAILURE reading "ci.yml must install bun from package.json"
    // against a ci.yml that does exactly that. Measured before the fix.
    expect(
      BUN_VERSION_FILE.test("        bun-version-file: package.json # from packageManager"),
    ).toBe(true);
    expect(BUN_VERSION_FILE.test("        bun-version-file: .bun-version")).toBe(false);
  });

  test("a workflow written as .yaml is not invisible to the guard", () => {
    // GitHub reads BOTH extensions; a guard that sweeps only one has a hole the
    // shape of whichever file someone names `.yaml`, and it reports clean.
    expect(
      ["ci.yml", "deploy.yaml", "README.md"].filter((f) => WORKFLOW_FILE.test(f)),
    ).toEqual(["ci.yml", "deploy.yaml"]);
  });

  test.if(GIT_ROOT !== null)(
    "this working tree has LF line endings, as .gitattributes requires",
    () => {
      // `.gitattributes` (`* text=auto eol=lf`) governs FUTURE checkouts. It does
      // not rewrite a tree you already have, so anyone who cloned before it
      // landed — or who has `core.autocrlf=true` and pulled — silently keeps CRLF
      // files, and every text-parsing guard here goes subtly wrong for them alone
      // while CI stays green, because Linux checks out LF.
      //
      // This asks GIT rather than reading a file, and that distinction is the
      // whole point. The first version of this test read its OWN source and
      // asserted no carriage return. That cannot work: the file is NEW, so a
      // stale CRLF tree receives a FRESH, LF copy of it on pull while every
      // pre-existing file stays CRLF — measured, the self-probe reported green on
      // a tree that was CRLF throughout. It was a guard that could not fire for
      // the one population it existed to catch.
      //
      // Anchored to THIS file's directory, not the process cwd: the question is
      // about the checkout the test lives in, and `bun test` can be run from
      // anywhere — including, in a worktree layout, a sibling repo.
      const listing = git(["-C", GIT_ROOT as string, "ls-files", "--eol"]);
      // git resolved the root moments ago, so a failure HERE is a real fault
      // rather than the absence the skip covers. Assert instead of skipping.
      expect(
        listing,
        "`git ls-files --eol` failed in a checkout git had just resolved. The " +
        "likely cause is a git too old for `--eol`; a skip here would hide " +
        "an uninspected tree, which is the failure this guard exists to stop.",
      ).not.toBeNull();

      // Split on either terminator. git emits LF — but this file exists because a
      // bare `\n` split is precisely how CR contamination gets in, and writing
      // the guard against it that way would be the joke telling itself.
      const lines = (listing as string).split(/\r?\n/).filter((line) => line.length > 0);

      // `i/<index>  w/<worktree>  attr/<attrs><TAB><path>`. If a line carries no
      // tab the format has changed under us, and every predicate below would
      // quietly match nothing — so fail rather than report a clean tree.
      expect(
        lines.filter((line) => !line.includes("\t")),
        "`git ls-files --eol` is no longer `<attrs><TAB><path>`, so this check " +
          "cannot answer. Reporting a clean tree here would be a guess.",
      ).toEqual([]);

      // Only `w/` is the tree's actual state — `i/` is the blob's, which is LF
      // here regardless. Binaries report `w/none` and never match. An explicit
      // `eol=crlf` attribute would make CRLF the correct answer for that file;
      // nothing sets one in any of these repos today, and honouring it costs one
      // predicate.
      const crlf = lines
        .map((line) => {
          const tab = line.indexOf("\t");
          return { meta: line.slice(0, tab), path: line.slice(tab + 1) };
        })
        // `w/mixed` counts as well as `w/crlf`. A file only PARTLY converted —
        // a refresh interrupted, an editor that saved CRLF into one file — is
        // still contaminated, and a line-oriented parser breaks on exactly the
        // affected lines. Matching `w/crlf` alone passes a half-fixed tree.
        .filter(({ meta }) => /w\/(crlf|mixed)/.test(meta) && !meta.includes("eol=crlf"))
        .map(({ path }) => path);

      expect(
        crlf.length,
        `${crlf.length} tracked file(s) carry CRLF line endings, whole or partial` +
          (crlf.length > 0 ? ` — e.g. ${crlf.slice(0, 5).join(", ")}` : "") +
          ".\n\n" +
          "`.gitattributes` asks for LF, but it only governs future checkouts — " +
          "it cannot rewrite a tree you already have. Commit or stash first (the " +
          "next command DISCARDS uncommitted work), then:\n\n" +
          "    git rm --cached -r . && git reset --hard\n\n" +
          "`git add --renormalize .` will NOT do it — that updates the index, " +
          "and the index here is already LF.",
      ).toBe(0);
    },
  );

  test("a CRLF checkout does not reopen the BORROW hole", () => {
    // `\r` as an ESCAPE, not a literal carriage return, so this fixture means
    // the same thing however this very file is checked out.
    //
    // Windows checkouts get CRLF (no .gitattributes normalises it, and
    // core.autocrlf=true is the default there), and `.` does not match `\r` in
    // JS while `\s` does. So `\s*$` absorbs the CR and matches, but
    // `(?:#.*)?$` does not — which breaks precisely the COMMENTED lines the
    // trailing-comment tolerance exists for, and leaves the uncommented ones
    // working. Both JOB_HEADER and JOB_TIMEOUT inherit it.
    //
    // The consequence is the borrow defect verbatim: an unrecognised job header
    // fails to terminate the inner scan, which runs on into the next job and
    // reports a genuinely unbounded job as bounded. Every other fixture here is
    // an LF literal, so none of them can reach this path.
    const crlf = [
      "jobs:",
      "  first:",
      "    runs-on: x",
      "  second:  # note",
      "    timeout-minutes: 20",
      "    runs-on: x",
    ].join("\r\n");
    expect(jobsWithoutTimeout(crlf)).toEqual(["first"]);
  });

  test("a job key with a trailing comment is still inspected", () => {
    // YAML allows `build:  # note`. The key regex required the line to end at
    // the colon, so such a job was skipped entirely and reported clean.
    expect(
      jobsWithoutTimeout("jobs:\n  build:  # the deploy image\n    runs-on: x\n"),
    ).toEqual(["build"]);
  });

  test("an unbounded job cannot BORROW the next job's timeout", () => {
    // The worse half of the same defect. The inner scan stops at the next job
    // header; if it cannot recognise one it runs on into that job and finds ITS
    // timeout-minutes — so a genuinely unbounded job is reported as bounded and
    // the guard returns green on exactly the workflow it exists to fail.
    expect(
      jobsWithoutTimeout(
        "jobs:\n  first:\n    runs-on: x\n  second:  # note\n    timeout-minutes: 20\n    runs-on: x\n",
      ),
    ).toEqual(["first"]);
  });

  test("a trailing comment on the declaration still counts as bounded", () => {
    // Regression guard for a bug in this file's own parser: requiring the line
    // to END at the digits reported `timeout-minutes: 30   # note` as missing,
    // a shape omni-fi-web's claude-code-review.yml has written since it was
    // added, and one any workflow landing here could write tomorrow.
    expect(
      jobsWithoutTimeout("jobs:\n  a:\n    timeout-minutes: 30   # backstop\n"),
    ).toEqual([]);
    expect(jobsWithoutTimeout("jobs:\n  a:\n    runs-on: x\n")).toEqual(["a"]);
  });
});
