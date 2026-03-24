# @amarsia/sdk

Official TypeScript/JavaScript SDK for Amarsia APIs.

`@amarsia/sdk` gives you a transparent API-style interface with state built in:

- Initialize once with `amarsia.init(...)`
- Use `client.run(...)` for one-shot responses
- Use `client.stream(...)` for streaming responses
- Use `client.conversation` for stateful conversation workflows with `conversation.id` and `conversation.data`

## Install

```bash
npm install @amarsia/sdk
```

## Quickstart

```ts
import { amarsia } from "@amarsia/sdk";

const client = amarsia.init({
  apiKey: process.env.AMARSIA_API_KEY!,
  deploymentId: "dep_123"
});

const result = await client.run({
  deploymentId: "dep_123",
  content: [{ type: "text", text: "Write a short intro for Amarsia." }]
});

console.log(result.content);
console.log(client.run.meta); // token/model metadata when available
```

## Initialization

```ts
import { amarsia } from "@amarsia/sdk";

const client = amarsia.init({
  apiKey: "YOUR_API_KEY", // required
  deploymentId: "dep_123", // optional default deployment for all calls
  baseUrl: "https://api.amarsia.com", // optional, defaults to this
  dangerouslyAllowBrowserApiKey: true // optional browser risk acknowledgment
});
```

### Deployment ID behavior

- provide `deploymentId` once in `amarsia.init(...)` for defaults
- optionally override per call in `run`, `stream`, or `conversation.send`
- if neither init nor call provides it, SDK throws a configuration error

## API overview

```ts
const client = amarsia.init({ apiKey: "...", deploymentId: "dep_123" });

await client.run({ content: [...] });
await client.stream({ content: [...] });
await client.conversation.send([...]);
```

All controllers expose state:

- `.status` -> `idle | loading | streaming | success | error`
- `.data` -> latest complete response
- `.stream` -> live stream buffer while streaming
- `.error` -> typed SDK error object
- `.meta` -> token/model/request metadata when present
- `.raw` -> raw response payload
- `.getState()` and `.subscribe(...)` for reactive UI updates

## Run API

```ts
const data = await client.run({
  content: [{ type: "text", text: "Explain vector search in one paragraph." }],
  variables: { audience: "developer" }
});

console.log(data.content);
console.log(client.run.data);
```

## Stream API

```ts
const unsubscribe = client.stream.subscribe((state) => {
  if (state.status === "streaming") {
    // progressively updated during stream
    console.log(state.stream);
  }
});

const data = await client.stream({
  content: [{ type: "text", text: "Generate a checklist for API launch." }]
});

console.log(data.content); // full final content
unsubscribe();
```

Abort an in-flight stream:

```ts
client.stream.abort();
```

## Conversation API (stateful)

`client.conversation` keeps an instance-scoped `conversation.id` until you call `conversation.start()`.

```ts
const conversation = client.conversation;

// First send creates a new conversation
await conversation.send([{ type: "text", text: "Help me plan a product demo." }], {
  meta: { team: "growth", channel: "web" }
});

console.log(conversation.id); // active conversation_id
console.log(conversation.data); // latest API response payload

// Next send continues same conversation with streaming endpoint under the hood
await conversation.send([{ type: "text", text: "Now make it shorter." }], {
  historyLimit: 10
});

// Continue a known conversation ID
conversation.start("conv_existing_123");
await conversation.send([{ type: "text", text: "Resume context." }]);
```

Start behavior:

```ts
conversation.start(); // clear local conversation state and start fresh
conversation.start("conv_existing_123"); // set active conversation id locally
```

Conversation helpers:

```ts
const messages = await conversation.loadMessages({ page: 1, pageSize: 20 });
const conversations = await conversation.list({
  page: 1,
  pageSize: 20,
  meta: { team: "growth" }
});

// With no args, loadMessages fetches the first page (API defaults)
const firstPageMessages = await conversation.loadMessages();

// Keep local messages and append another page
await conversation.loadMessages({ page: 2, pageSize: 20, append: true });
```

## React / Next.js usage

This package is framework-agnostic. In React/Next, use `subscribe/getState` to keep UI synced.

```tsx
import { useEffect, useMemo, useState } from "react";
import { amarsia } from "@amarsia/sdk";

const client = amarsia.init({
  apiKey: process.env.NEXT_PUBLIC_AMARSIA_API_KEY!,
  deploymentId: process.env.NEXT_PUBLIC_AMARSIA_DEPLOYMENT_ID!
});

export function ChatWidget() {
  const conversation = useMemo(() => client.conversation, []);
  const [state, setState] = useState(conversation.getState());

  useEffect(() => {
    return conversation.subscribe(setState);
  }, [conversation]);

  async function onSend(prompt: string) {
    await conversation.send([{ type: "text", text: prompt }]);
  }

  return (
    <div>
      <div>Conversation ID: {state.id ?? "not started"}</div>
      <div>Status: {state.status}</div>
      <pre>{state.stream || String(state.data?.content ?? "")}</pre>
      <button onClick={() => void onSend("Hello")}>Send</button>
    </div>
  );
}
```

## Content format

Text:

```ts
[{ type: "text", text: "Hello" }]
```

File/url input:

```ts
[
  {
    type: "image",
    mime_type: "image/png",
    file_uri: "https://example.com/image.png"
  }
]
```

Supported non-text `type` values are `image`, `video`, `audio`, and `url`.

## Error handling

SDK methods throw `AmarsiaSdkError` with normalized fields.

```ts
import { AmarsiaSdkError } from "@amarsia/sdk";

try {
  await client.run({
    content: [{ type: "text", text: "Hello" }]
  });
} catch (error) {
  if (error instanceof AmarsiaSdkError) {
    console.error(error.name, error.message, error.status, error.code);
  } else {
    console.error(error);
  }
}
```

## Security guidance

If you use long-lived API keys in browser apps, keys can be extracted and abused.

Recommended production approach:

- Keep primary API keys on your backend
- Call Amarsia from a backend route/proxy
- If you must call from browser, use short-lived tokens and rotate frequently

The SDK warns in browser contexts unless `dangerouslyAllowBrowserApiKey: true` is set during init.
