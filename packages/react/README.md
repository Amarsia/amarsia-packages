# @amarsia/react

React wrapper for `@amarsia/sdk`.

- docs: [docs.amarsia.com](https://docs.amarsia.com)
- npm: [@amarsia/react](https://www.npmjs.com/package/@amarsia/react)
- repository: [amarsia-packages/packages/react](https://github.com/Amarsia/amarsia-packages/tree/main/packages/react)
- core SDK: [@amarsia/sdk](https://www.npmjs.com/package/@amarsia/sdk)

This package is intentionally thin:

- no API/config logic duplicated from SDK
- no custom state model
- only React hooks over SDK controllers

Any behavior changes in `@amarsia/sdk` automatically flow through here.

## What Is `@amarsia/react`?

`@amarsia/react` is the official React and Next.js integration for Amarsia AI APIs. It gives you simple stateful hooks for:

- one-shot AI calls (`useRun`)
- streaming AI output (`useStream`)
- stateful multi-turn chat (`useConversation`)

This is useful for chat UIs, copilots, AI forms, and agentic app experiences.

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
  const { conversation, id, status, live, data } = useConversation(client);

  async function onSend(prompt: string) {
    await conversation.stream({
      content: [{ type: "text", text: prompt }]
    });
  }

  return (
    <div>
      <div>Conversation ID: {id ?? "not started"}</div>
      <div>Status: {status}</div>
      <pre>{live || String(data?.content ?? "")}</pre>
      <button onClick={() => void onSend("Hello")}>Send</button>
    </div>
  );
}
```

## API

## API Contract Reference

`@amarsia/react` is a thin hook layer over SDK controller contracts.

### Hook input contract

Each hook accepts the corresponding controller from a single SDK client:

```ts
const client = amarsia.init(...);
useRun(client);          // uses client.run
useStream(client);       // uses client.stream
useConversation(client); // uses client.conversation
useAmarsia(client);      // all three
```

### Shared hook state contract

All hook states include:

```ts
{
  status: "idle" | "loading" | "streaming" | "success" | "error";
  data: unknown | null;
  live: string; // transient live stream buffer
  error: { name: string; message: string; ... } | null;
  meta: Record<string, unknown> | null;
  raw: unknown;
}
```

### `useRun(client)`

Returns SDK run state + callable run controller.

```tsx
import { useRun } from "@amarsia/react";

const { run, status, data, error, meta, live } = useRun(client);
await run({
  content: [{ type: "text", text: "Write a release note." }]
});
```

`run` callable contract (from SDK):

```ts
run({
  content: MessageContent[];
  variables?: Record<string, unknown>;
  deploymentId?: string;
}): Promise<RunResponse>
```

### `useStream(client)`

Returns SDK stream state + callable stream controller.

```tsx
import { useStream } from "@amarsia/react";

const { stream: streamController, status, live, data } = useStream(client);
await streamController({
  content: [{ type: "text", text: "Generate checklist." }]
});
```

Abort current stream:

```ts
streamController.abort();
```

`stream` callable contract (from SDK):

```ts
stream({
  content: MessageContent[];
  variables?: Record<string, unknown>;
  deploymentId?: string;
  signal?: AbortSignal;
}): Promise<StreamResponse>
```

### `useConversation(client)`

Returns SDK conversation state + conversation controller.

```tsx
import { useConversation } from "@amarsia/react";

const { conversation, id, messages, messagesPageInfo } = useConversation(client);

conversation.start(); // new clean state
conversation.start("conv_existing_123"); // bind to known conversation

await conversation.run({
  content: [{ type: "text", text: "Continue this chat." }]
});

await conversation.loadMessages(); // first page with API defaults
await conversation.loadMessages({ page: 2, pageSize: 20, append: true }); // append + dedupe by message id

await conversation.list({
  page: 1,
  pageSize: 20,
  meta: { team: "growth" }
});
```

`conversation` callable contract (from SDK):

```ts
conversation.start(conversationId?: string, deploymentId?: string): void;

conversation.run({
  content: MessageContent[];
  historyLimit?: number;
  signal?: AbortSignal;
  variables?: Record<string, unknown>; // fresh-conversation only
  meta?: Record<string, string | number | boolean>; // fresh-conversation only
}): Promise<ConversationData>;

conversation.stream({
  content: MessageContent[];
  historyLimit?: number;
  signal?: AbortSignal;
  variables?: Record<string, unknown>; // fresh-conversation only
  meta?: Record<string, string | number | boolean>; // fresh-conversation only
}): Promise<ConversationData>;

conversation.loadMessages({ page?, pageSize?, append? }): Promise<ConversationMessage[]>;
conversation.list({ page?, pageSize?, meta? }): Promise<Array<Record<string, unknown>>>;
conversation.abort(): void;
```

### `useAmarsia(client)`

Convenience hook that returns all three:

```tsx
import { useAmarsia } from "@amarsia/react";

const { run, stream, conversation } = useAmarsia(client);
```

Return contract:

```ts
{
  run: ReturnType<typeof useRun>;
  stream: ReturnType<typeof useStream>;
  conversation: ReturnType<typeof useConversation>;
}
```

## Why this package is simple

- Uses `useSyncExternalStore` only; no hidden reducer/context layer.
- Reads SDK state directly via `getState()` and `subscribe(...)`.
- Calls SDK methods directly (`run(...)`, `stream(...)`, `conversation.run(...)`, `conversation.stream(...)`).

If you already use `@amarsia/sdk`, this package just removes manual `useState/useEffect` wiring.

## FAQ

### Is this the official Amarsia React package?

Yes. `@amarsia/react` is the official React wrapper for `@amarsia/sdk`.

### Do I need both `@amarsia/react` and `@amarsia/sdk`?

`@amarsia/react` installs `@amarsia/sdk` automatically. If you import SDK APIs directly in your app, install both explicitly.

### Does this support Next.js?

Yes. The hooks work in React and Next.js client components.

### Where is payload field-level API reference?

See `@amarsia/sdk` README API reference section and full docs at [docs.amarsia.com](https://docs.amarsia.com).

### Search terms

Amarsia React SDK, Amarsia Next.js SDK, Amarsia React hooks, Amarsia streaming chat React, Amarsia conversation hooks.
