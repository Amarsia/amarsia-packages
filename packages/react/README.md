# @amarsia/react

React wrapper for `@amarsia/sdk`.

This package is intentionally thin:

- no API/config logic duplicated from SDK
- no custom state model
- only React hooks over SDK controllers

Any behavior changes in `@amarsia/sdk` automatically flow through here.

## Install

```bash
npm install @amarsia/react
```

`@amarsia/react` already depends on `@amarsia/sdk`, so it is installed automatically.

If your app imports from `@amarsia/sdk` directly (for example `amarsia.init(...)`), install both explicitly:

```bash
npm install @amarsia/react @amarsia/sdk
```

## Quick Start

```tsx
import { amarsia } from "@amarsia/sdk";
import { useConversation } from "@amarsia/react";

const client = amarsia.init({
  apiKey: process.env.NEXT_PUBLIC_AMARSIA_API_KEY!,
  deploymentId: process.env.NEXT_PUBLIC_AMARSIA_DEPLOYMENT_ID!
});

export function Chat() {
  const { conversation, id, status, stream, data } = useConversation(client);

  async function onSend(prompt: string) {
    await conversation.send([{ type: "text", text: prompt }]);
  }

  return (
    <div>
      <div>Conversation ID: {id ?? "not started"}</div>
      <div>Status: {status}</div>
      <pre>{stream || String(data?.content ?? "")}</pre>
      <button onClick={() => void onSend("Hello")}>Send</button>
    </div>
  );
}
```

## API

### `useRun(client)`

Returns SDK run state + callable run controller.

```tsx
import { useRun } from "@amarsia/react";

const { run, status, data, error, meta, stream } = useRun(client);
await run({
  content: [{ type: "text", text: "Write a release note." }]
});
```

### `useStream(client)`

Returns SDK stream state + callable stream controller.

```tsx
import { useStream } from "@amarsia/react";

const { stream: streamController, status, stream, data } = useStream(client);
await streamController({
  content: [{ type: "text", text: "Generate checklist." }]
});
```

Abort current stream:

```ts
streamController.abort();
```

### `useConversation(client)`

Returns SDK conversation state + conversation controller.

```tsx
import { useConversation } from "@amarsia/react";

const { conversation, id, messages, messagesPageInfo } = useConversation(client);

conversation.start(); // new clean state
conversation.start("conv_existing_123"); // bind to known conversation

await conversation.send([{ type: "text", text: "Continue this chat." }]);

await conversation.loadMessages(); // first page with API defaults
await conversation.loadMessages({ page: 2, pageSize: 20, append: true }); // append + dedupe by message id

await conversation.list({
  page: 1,
  pageSize: 20,
  meta: { team: "growth" }
});
```

### `useAmarsia(client)`

Convenience hook that returns all three:

```tsx
import { useAmarsia } from "@amarsia/react";

const { run, stream, conversation } = useAmarsia(client);
```

## Why this package is simple

- Uses `useSyncExternalStore` only; no hidden reducer/context layer.
- Reads SDK state directly via `getState()` and `subscribe(...)`.
- Calls SDK methods directly (`run(...)`, `stream(...)`, `conversation.send(...)`).

If you already use `@amarsia/sdk`, this package just removes manual `useState/useEffect` wiring.
