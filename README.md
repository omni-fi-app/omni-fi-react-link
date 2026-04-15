# @omni-fi/react-link

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

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
  const { open, ready } = useOmniFILink({
    token: linkToken,
    onSuccess(publicToken) {
      // Exchange publicToken on your server for a permanent connection_id.
      console.log("Connected:", publicToken);
    },
    onError(error) {
      console.error("Link error:", error.code, error.message);
    },
    onExit() {
      console.log("Widget closed.");
    },
  });

  return (
    <button onClick={open} disabled={!ready}>
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
| `ready`   | `boolean`    | `true` once the CDN script has loaded.           |
| `destroy` | `() => void` | Manually unmount the widget and event listeners. |

### `OmniFIConfig`

| Property      | Type                                   | Required | Description                                |
| ------------- | -------------------------------------- | -------- | ------------------------------------------ |
| `token`       | `string`                               | Yes      | Short-lived `link_token` from your server. |
| `onSuccess`   | `(publicToken: string) => void`        | Yes      | Called on successful connection.           |
| `displayMode` | `'iframe' \| 'popup'`                  | No       | Defaults to `iframe`.                      |
| `environment` | `'production' \| 'staging' \| 'local'` | No       | Defaults to `production`.                  |

---

## License

[MIT](./LICENSE) © 2026 Omni-FI
