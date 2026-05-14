# @omni-fi/react-link

[![License](https://img.shields.io/github/license/omni-fi-app/omni-fi-react-link.svg)](./LICENSE)

Official React SDK for the [Omni-FI](https://omni-fi.co) Link widget. Provides a lightweight `useOmniFILink` hook that loads the Omni-FI Connect script from the CDN and manages the widget lifecycle.

---

## How it works

The widget runs in an **isolated hosted iframe**. Cross-Origin Resource Sharing (CORS) rules prevent the parent page from reading keystrokes, ensuring raw credentials never touch your application. On success, your `onSuccess` callback receives a payload containing one or more connections — each with both a stable `connectionId` (the persisted Connection's UUID) and an opaque `publicToken` you can exchange server-side.

```
Your App  →  link_token  →  Widget (isolated iframe)
Your App  ←  { connections: [{ publicToken, connectionId, institutionId, customerType }] }  ←  Widget
```

---

## Installation

```bash
# Bun
bun add @omni-fi/react-link

# npm
npm install @omni-fi/react-link

# yarn
yarn add @omni-fi/react-link
```

Requires **React 18 or 19** as a peer dependency.

---

## Usage

```tsx
import { useOmniFILink } from "@omni-fi/react-link";

function ConnectButton({ linkToken }: { linkToken: string }) {
  const { open, isReady } = useOmniFILink({
    token: linkToken,
    onSuccess({ connections }) {
      for (const { publicToken, connectionId, institutionId, customerType } of connections) {
        // `connectionId` addresses the persisted Connection record directly
        // (e.g. PUT /connections/{id}/accounts). Exchange `publicToken` on
        // your server for an opaque API token when needed.
        console.log("Connected:", institutionId, customerType, connectionId, publicToken);
      }
    },
    onError(error) {
      console.error("Link error:", error.code, error.message);
    },
    onExit() {
      console.log("Widget closed.");
    },
  });

  return (
    <button onClick={open} disabled={!isReady}>
      Connect your bank
    </button>
  );
}
```

---

## Creating a link token

The `token` prop is a short-lived `LinkToken` your server creates via the Omni-FI API before mounting the widget. It is never generated client-side.

```bash
POST /connections/link-token
Authorization: Bearer <your-api-key>
{
  "ClientUserId": "user_123",
  "RedirectOrigin": "https://your-app.com"
}
```

Pass the returned `LinkToken` value directly as the `token` prop.

### Customising the widget session

All five fields below are optional. Omitting them keeps the current default behaviour — nothing changes for existing integrations.

#### RequestedScopes — control the consent screen

By default the widget asks the end user to consent to four data categories. You can limit this to only what your integration actually needs:

```bash
POST /connections/link-token
{
  "ClientUserId": "user_123",
  "RedirectOrigin": "https://your-app.com",
  "RequestedScopes": ["accounts", "data"]
}
```

The consent screen then shows only "Account Access" and "Transaction Data" — a more targeted, trustworthy prompt for your users.

| Scope | Description |
|-------|-------------|
| `accounts` | Bank account balances, account numbers, and metadata |
| `insights` | Financial analytics and spending pattern analysis |
| `alerts` | Transaction notifications and balance alerts |
| `data` | Transaction history and statement data |

Omit `RequestedScopes` to show all four. Passing an unknown identifier or an empty array returns `400 VALIDATION_ERROR`.

---

#### AppName and AppLogoUrl — white-label the widget

Display your application's name and logo on the widget's consent screen:

```bash
{
  "ClientUserId": "user_123",
  "RedirectOrigin": "https://your-app.com",
  "AppName": "Acme Finance",
  "AppLogoUrl": "https://your-cdn.com/logo.png"
}
```

`AppName` falls back to your ApiClient's registered name if omitted. `AppLogoUrl` is only displayed if provided — the widget shows text-only branding otherwise. Useful when one ApiClient powers multiple products or environments and each needs its own branding.

---

#### AccountSelectionEnabled — skip the account-select step

After the user connects a bank, Omni-FI can show an account-selection screen where the user picks which accounts to import. You can override the default on a per-session basis:

```bash
{
  "ClientUserId": "user_123",
  "RedirectOrigin": "https://your-app.com",
  "AccountSelectionEnabled": false
}
```

`true` shows the account-selection step; `false` skips it and imports all accounts silently. Omit to inherit the setting configured on your ApiClient.

---

#### WebhookUrl — route events per session

By default, `connection.created` webhook events are sent to the URL configured on your ApiClient's `WebhookEndpoint`. You can route a specific session's events to a different URL:

```bash
{
  "ClientUserId": "user_123",
  "RedirectOrigin": "https://your-app.com",
  "WebhookUrl": "https://staging.your-app.com/webhooks/omni-fi"
}
```

The same signing secret from your registered `WebhookEndpoint` is used to sign the delivery — verify the `X-Omni-FI-Signature` header as normal. If you have not configured a `WebhookEndpoint` on your ApiClient, `WebhookUrl` is stored but no event is fired.

**Common use case:** route events from staging link tokens to your staging webhook receiver, and production tokens to your production receiver, without needing separate ApiClients.

---

## API

### `useOmniFILink(config: OmniFIConfig)`

| Property  | Type         | Description                                      |
| --------- | ------------ | ------------------------------------------------ |
| `open`    | `() => void` | Opens the Link widget modal/popup.               |
| `destroy` | `() => void` | Closes the widget and cleans up its handlers. Called automatically on unmount. |
| `isReady` | `boolean`    | `true` once the CDN script has loaded.           |
| `error`   | `Error \| null` | Set if the CDN script fails to load.          |

### `OmniFIConfig`

| Property      | Type                                   | Required | Description                                |
| ------------- | -------------------------------------- | -------- | ------------------------------------------ |
| `token`       | `string`                                      | Yes      | Short-lived `link_token` from your server. |
| `onSuccess`   | `(payload: OmniFISuccessPayload) => void`     | Yes      | Called once all connections are complete. `payload.connections` is an array of `{ publicToken, connectionId, institutionId, customerType }`. `connectionId` is the persisted Connection's UUID — addressable via the connection-scoped REST endpoints; `publicToken` is the opaque token you exchange server-side. |
| `onError`     | `(error: OmniFIError) => void`                | No       | Called when the widget reports an error. |
| `onExit`      | `() => void`                                  | No       | Called when the user closes the widget without completing. |
| `onEvent`     | `(eventName: string, metadata?: Record<string, unknown>) => void` | No       | Called for intermediate events (e.g., `omni-fi:connection-linked` per bank linked). |
| `displayMode` | `'iframe' \| 'popup'`                         | No       | Defaults to `iframe`.                      |
| `environment` | `'production' \| 'staging' \| 'local'`        | No       | Defaults to `production`.                  |
| `scriptUrl`   | `string`                                      | No       | Override the CDN script URL. For clients that need to pin to a specific hosted version. |

---

## MFA handling

The hosted widget handles multi-factor authentication **internally** — when an
institution requests an OTP, the widget renders its own OTP screen, collects
the code, submits it, and (on success) advances to Account-Select transparently
from the SDK consumer's perspective. There is **no** `omni-fi:mfa-challenge`
event today, so subscribing to one via `onEvent` would never fire.

> **Future surface.** MFA delivery metadata (`mfaDestination`,
> `mfaDestinationKind`, `mfaLength`) is part of the widget's internal contract
> with the backend but is not yet surfaced as an `onEvent` callback. The SDK
> will expose `omni-fi:mfa-challenge` (and a typed payload) in a follow-up
> release once the widget producer side ships. The institution-level
> `OmniFIMfaType` union is already exported for forward compatibility.

---

## Testing in sandbox

When the `link_token` is issued in `sandbox` mode, the widget exercises a fully
self-contained flow with no live bank traffic. **Two independent inputs**
control the flow:

1. **Username** chooses the auth path — `sandbox_user` follows the happy
   path, `user_mfa` triggers the MFA branch (when the institution supports
   MFA).
2. **Institution** chooses the MFA variant — `inst_mock_sms` /
   `inst_mock_email` / `inst_mock_totp` map 1:1 onto the three MFA modes.
   `inst_mock` is the no-MFA institution and ignores `user_mfa`.

The widget handles the MFA challenge UI itself (no SDK event today); consumers
observe the flow end-to-end via the eventual `onSuccess` callback.

### Mock institutions

| Institution ID     | Display name                | `mfaType` | Destination                 | Length |
| ------------------ | --------------------------- | --------- | --------------------------- | ------ |
| `inst_mock_sms`    | Mock SMS Bank               | `sms`     | `+230 5*** 1234`            | 4      |
| `inst_mock_email`  | Mock Email Bank             | `email`   | `j***@example.com`          | 4      |
| `inst_mock_totp`   | Mock Authenticator Bank     | `totp`    | _(none — authenticator app)_ | 6      |
| `inst_mock`        | Mock Happy-Path Bank        | `none`    | _(no MFA branch)_            | —      |

### Sandbox usernames

| Username       | Behaviour                                                                                |
| -------------- | ---------------------------------------------------------------------------------------- |
| `sandbox_user` | Happy path on any institution — no MFA branch even on MFA-capable mocks.                  |
| `user_mfa`     | Triggers the MFA branch on MFA-capable institutions (`inst_mock_sms` / `_email` / `_totp`). On `inst_mock` (`mfaType: 'none'`) it falls through to the happy path. |

### Sandbox OTP codes

| Code            | Branch        | Result                                   |
| --------------- | ------------- | ---------------------------------------- |
| `1234`          | `sms` / `email` | Accepted.                                |
| `123456`        | `totp`        | Accepted.                                |
| anything else   | any           | Rejected with `LOGIN_FAILED` (wrong-code path — useful for exercising error UX). |

To exercise each MFA flow end-to-end:

1. Issue a sandbox `link_token` from your server.
2. Mount the widget with `useOmniFILink({ token, ... })`.
3. Pick the MFA-capable mock bank that matches the variant you want to demo
   (`inst_mock_sms` / `inst_mock_email` / `inst_mock_totp`).
4. Enter `user_mfa` as the username (any password). The widget surfaces the
   matching MFA screen.
5. Enter the canonical correct code for the variant (`1234` for SMS/EMAIL,
   `123456` for TOTP). Any other code returns `LOGIN_FAILED`, letting you
   exercise the wrong-code error path against the real backend.

---

## Development

### Test convention

TypeScript tests are co-located alongside source files as `*.test.ts`. Do not use `__tests__/` directories.

```
src/
├── useOmniFILink.ts
├── useOmniFILink.test.ts       ← co-located unit tests
├── sdk-passthrough.test.ts     ← co-located regression tests
└── types.ts
```

Run tests with:

```bash
bun test
```

---

## License

[MIT](./LICENSE) © 2026 Omni-FI
