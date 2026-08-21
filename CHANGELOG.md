# Changelog

All notable changes to `@omni-fi/react-link` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- **`onSuccess` now receives the documented `{ connections }` payload.** The
  loader invokes `onSuccess(data.connections)` with the bare array, but the SDK
  typed and documented the envelope and passed the host callback straight
  through — so a host destructuring `{ connections }` got `undefined` and never
  saw its connections. `useOmniFILink` now adapts between the two shapes. The
  loader is unchanged, because vanilla-JS integrations depend on its shape.

### Added
- `institutionName` and `institutionNameShort` on `OmniFIConnection`. Render
  `institutionNameShort` — a bank's personal and business tiers share one legal
  name, so `institutionName` alone cannot tell them apart.
- `connectionGroupId` and `profileDisplayName` on `OmniFIConnection`, for
  multi-profile institutions where one login yields several Connections.
- `INLINE_ERROR` and `READY_ACK` on `OMNIFI_EVENTS`, and
  `OmniFIInlineErrorPayload` typing the metadata `omni-fi:inline-error`
  delivers (`code`, `message`, `screen`, `institutionId`).
- `OmniFIWidgetLoaderConfig` — the loader's real config shape, exported so a
  test double cannot silently disagree with it.

### Changed
- `OmniFIErrorCode` is now `OmniFIKnownErrorCode | (string & {})`. It gained
  the terminal bank-flow codes (`AUTH_INVALID_CREDENTIALS`,
  `INSTITUTION_UNAVAILABLE`, `ACCOUNT_NOT_FOUND`, the short-form session codes
  and others), but stops claiming the set is closed: the widget posts its
  `errorType` verbatim and that can originate in the backend, so a `default:`
  branch must stay reachable. `OmniFIKnownErrorCode` is the closed union if you
  need exhaustiveness. Removes the `as ExtendedErrorCode` cast the README
  previously required.

### Added
- `env` field on `useOmniFILink` config (`'development' | 'staging' | 'production'`,
  default `'production'`). Single source of truth for env signalling — drives
  both the SDK loader-script CDN URL **and** the env signal forwarded to the
  widget iframe runtime (the loader's `environment` field is derived from
  `env` internally). Replaces the previous `environment` field; consumers
  only need to set one thing. Exported alongside the `OmniFIEnv` type and
  the underlying `getScriptUrl(env)` helper.
- Documented sandbox magic-email credentials for error-screen testing
  (`sandbox.invalid-credentials@example.com`, `sandbox.locked@example.com`,
  `sandbox.timeout@example.com`, `sandbox.unavailable@example.com`,
  `sandbox.network-error@example.com`, `sandbox.account-not-found@example.com`,
  `sandbox.ui-flow-broken@example.com`) — see README "Testing your integration"
  section.
- Documented the `?widget_simulate_error=<TYPE>` URL-param override for
  visual QA of error states without walking the credentials form.
- Documented the new `omni-fi:inline-error` event for non-terminal,
  in-place-recoverable failures (bad credentials, wrong OTP, account
  permissions rejection). Subscribed via the existing `onEvent`
  callback. Terminal `onError` semantics unchanged.
- Documented the widget's Resend control on the MFA screen: it makes a
  real `POST /sync/{jobId}/resend` backend call with a server-driven
  cooldown (per omni-fi-core's resend / watermark contract), bumps a
  per-challenge resend counter, and — in production — triggers a fresh
  OTP dispatch against the institution. SDK consumers see no new public
  surface; the README documents how to exercise the timing in sandbox
  (where the mocks participate in the bookkeeping without dispatching
  any real OTP).

### Changed
- The `scriptUrl` override remains an escape hatch (version pinning, self-hosting)
  and takes precedence over `env` when both are supplied. Documented as advanced
  usage in the new README "Environments" section.
- Restructured the README's sandbox / testing content into a single
  "Testing your integration" section with three subsections (sandbox mode,
  happy path, error states). Folded the existing mock-institution and OTP
  tables into the new structure.
- Updated the happy-path sandbox username table to reflect the upstream
  email-shape rollout: `sandbox_user` → `sandbox@example.com`,
  `user_mfa` → `sandbox.mfa@example.com`, both paired with `sandbox_password`.
- Updated the `inst_mock_email` canonical OTP code to `abcdef`
  (case-insensitive, alphanumeric, 6 chars) to match the upstream
  `mfa_charset` redesign. SMS code aligned to `123456` (numeric, 6 chars
  — was `1234` in earlier sandbox iterations). TOTP code unchanged
  (`123456`, 6 chars). All three canonical codes are now 6 characters
  long, matching the dominant real-bank OTP shape.
