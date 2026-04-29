# @omni-fi/react-link

[![License](https://img.shields.io/github/license/omni-fi-app/omni-fi-react-link.svg)](./LICENSE)

Official React SDK for the [Omni-FI](https://omni-fi.co) Link widget. Provides a lightweight `useOmniFILink` hook that loads the Omni-FI Connect script from the CDN and manages the widget lifecycle.

---

## How it works

The widget runs in an **isolated hosted iframe**. Cross-Origin Resource Sharing (CORS) rules prevent the parent page from reading keystrokes, ensuring raw credentials never touch your application. On success, the widget posts an opaque `public_token` back to your app — the only value your application ever handles.

```
Your App  →  link_token  →  Widget (isolated iframe)
Your App  ←  public_token  ←  Widget (postMessage on success)
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
      for (const { publicToken, institutionId, customerType } of connections) {
        // Exchange each publicToken on your server for a permanent connection_id.
        console.log("Connected:", institutionId, customerType, publicToken);
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
| `onSuccess`   | `(payload: OmniFISuccessPayload) => void`     | Yes      | Called once all connections are complete. `payload.connections` is an array of `{ publicToken, institutionId, customerType }`. |
| `onError`     | `(error: OmniFIError) => void`                | No       | Called when the widget reports an error. |
| `onExit`      | `() => void`                                  | No       | Called when the user closes the widget without completing. |
| `onEvent`     | `(eventName: string, metadata?) => void`      | No       | Called for intermediate events (e.g., `omni-fi:connection-linked` per bank linked). |
| `displayMode` | `'iframe' \| 'popup'`                         | No       | Defaults to `iframe`.                      |
| `environment` | `'production' \| 'staging' \| 'local'`        | No       | Defaults to `production`.                  |
| `scriptUrl`   | `string`                                      | No       | Override the CDN script URL. For clients that need to pin to a specific hosted version. |

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
