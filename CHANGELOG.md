# Changelog

All notable changes to `@omni-fi/react-link` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Documented sandbox magic-email credentials for error-screen testing
  (`sandbox.invalid-credentials@example.com`, `sandbox.locked@example.com`,
  `sandbox.timeout@example.com`, `sandbox.unavailable@example.com`,
  `sandbox.network-error@example.com`, `sandbox.account-not-found@example.com`,
  `sandbox.ui-flow-broken@example.com`) — see README "Testing your integration"
  section.
- Documented the `?widget_simulate_error=<TYPE>` URL-param override for
  visual QA of error states without walking the credentials form.

### Changed
- Restructured the README's sandbox / testing content into a single
  "Testing your integration" section with three subsections (sandbox mode,
  happy path, error states). Folded the existing mock-institution and OTP
  tables into the new structure.
- Updated the happy-path sandbox username table to reflect the email-shape
  rollout (omni-fi-core PR #223): `sandbox_user` → `sandbox@example.com`,
  `user_mfa` → `sandbox.mfa@example.com`, both paired with `sandbox_password`.
- Updated the `inst_mock_email` canonical OTP code to `abcd`
  (case-insensitive, alphanumeric) to match the upstream `mfa_charset`
  redesign. SMS / TOTP codes unchanged (`1234` / `123456`).
