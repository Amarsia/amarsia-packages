# @amarsia/sdk

Official TypeScript/JavaScript SDK for Amarsia APIs.

- docs: [docs.amarsia.com](https://docs.amarsia.com)
- npm: [@amarsia/sdk](https://www.npmjs.com/package/@amarsia/sdk)
- repository: [amarsia-packages/packages/sdk](https://github.com/Amarsia/amarsia-packages/tree/main/packages/sdk)
- React wrapper: [@amarsia/react](https://www.npmjs.com/package/@amarsia/react)

`@amarsia/sdk` gives you a transparent API-style interface with state built in:

- Initialize once with `amarsia.init(...)`
- Use `client.run(...)` for one-shot responses
- Use `client.stream(...)` for streaming responses
- Use `client.conversation` for stateful conversation workflows with `conversation.id` and `conversation.data`

## What Is `@amarsia/sdk`?

`@amarsia/sdk` is the official Amarsia AI SDK for JavaScript and TypeScript. It provides:

- `run` for one-shot runner API requests
- `stream` for streaming AI output
- `conversation` for stateful multi-turn chat with conversation history

It is designed for Node.js, browser apps, Next.js apps, and agentic workflows where you need simple API access with built-in state.

## Install

```bash
npm install @amarsia/sdk
```

## Quick Start

```ts
import { amarsia } from "@amarsia/sdk";

const client = amarsia.init({
  apiKey: process.env.AMARSIA_API_KEY!,
  deploymentId: "dep_123"
});

const result = await client.run({
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

- `run` and `stream` use `deploymentId` from `amarsia.init(...)` by default.
- `run` and `stream` can still override `deploymentId` per call.
- `conversation` uses the deployment context set via `conversation.start(..., deploymentId?)`; if omitted there, it falls back to init-level default.
- If no deployment id is available from either source, SDK throws a configuration error.

## API overview

```ts
const client = amarsia.init({ apiKey: "...", deploymentId: "dep_123" });

await client.run({ content: [...] });
await client.stream({ content: [...] });
client.conversation.start();
await client.conversation.stream({ content: [...] });
```

All controllers expose state:

- `.status` -> `idle | loading | streaming | success | error`
- `.data` -> latest complete response payload
- `.live` -> live stream buffer only during streaming (cleared after completion)
- `.error` -> typed SDK error object
- `.meta` -> token/model/request metadata when present
- `.raw` -> raw response payload
- `.getState()` and `.subscribe(...)` for reactive UI updates

### `.data` vs `.live`

- Use `.live` for live token/chunk rendering while a stream is in progress.
- Use `.data` for the final completed response after the call finishes.
- For streaming calls, `.live` is intentionally transient and reset to empty on completion.

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
    console.log(state.live);
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

`client.conversation` keeps an instance-scoped conversation context (`conversation.id`, `deploymentId`, state, history helpers).

### 1) Start a conversation context

```ts
const conversation = client.conversation;

conversation.start(); // new local conversation context, use init deploymentId
conversation.start("conv_existing_123"); // bind to existing conversation id
conversation.start(undefined, "dep_support"); // new context + specific deployment
conversation.start("conv_existing_123", "dep_support"); // bind both
```

Important:
- `conversation.start(...)` is the only place to set conversation id and conversation deployment context.
- `conversation.run(...)` and `conversation.stream(...)` do not accept conversation id or deployment id overrides.

### 2) Continue conversation (run vs stream)

Use `conversation.run(...)` for single complete responses and `conversation.stream(...)` for live chunked output.

```ts
// non-stream continuation (final response only)
await conversation.run({
  content: [{ type: "text", text: "Summarize the previous answer." }],
  historyLimit: 10
});

// stream continuation (live chunks + final response)
await conversation.stream({
  content: [{ type: "text", text: "Now explain in bullet points." }],
  historyLimit: 10
});
```

Fresh conversation rule:
- `variables` and `meta` are accepted only when no active conversation id exists (fresh conversation creation path).
- If a conversation id is already active, passing `variables` or `meta` throws a validation error.

### 3) Query old conversations and messages

```ts
// list old conversations using meta filters
const conversations = await conversation.list({
  page: 1,
  pageSize: 20,
  meta: { team: "growth" }
});

// get messages for the active conversation id
const firstPage = await conversation.loadMessages(); // API defaults
const nextPage = await conversation.loadMessages({ page: 2, pageSize: 20, append: true });
```

`append: true` merges new pages into local state and deduplicates by message `id`.

### 4) Conversation state fields

- `conversation.id`: current active conversation id
- `conversation.deploymentId`: active deployment context for conversation calls
- `conversation.status`: `idle | loading | streaming | success | error`
- `conversation.data`: latest complete conversation response payload
- `conversation.live`: transient streaming buffer (cleared on completion)
- `conversation.meta`: model/token/request metadata when present
- `conversation.messages`: locally cached messages from `loadMessages(...)`
- `conversation.messagesPageInfo`: paging info for messages
- `conversation.conversations`: locally cached list from `list(...)`
- `conversation.conversationsPageInfo`: paging info for conversations
- `conversation.error`: typed SDK error object
- `conversation.raw`: latest raw response envelope/payload

## React / Next.js

For React/Next usage, use [@amarsia/react](https://www.npmjs.com/package/@amarsia/react) instead of manually wiring `useState` + `useEffect`.

- React package README: [amarsia-packages/packages/react](https://github.com/Amarsia/amarsia-packages/tree/main/packages/react)
- Full docs: [docs.amarsia.com](https://docs.amarsia.com)

## API Reference (Types and field meaning)

### `amarsia.init` contract

```ts
type InitConfig = {
  apiKey: string;
  deploymentId?: string;
  baseUrl?: string;
  dangerouslyAllowBrowserApiKey?: boolean;
  fetch?: typeof globalThis.fetch;
};
```

### Stateful controller contract

All stateful controllers (`client.run`, `client.stream`, `client.conversation`) expose:

```ts
{
  status: "idle" | "loading" | "streaming" | "success" | "error";
  data: unknown | null; // latest complete response payload
  live: string; // transient live stream buffer
  error: { name: string; message: string; ... } | null;
  meta: Record<string, unknown> | null;
  raw: unknown;
  getState(): Readonly<State>;
  subscribe(listener: (state: Readonly<State>) => void): () => void;
}
```

### `MessageContent`

```ts
type MessageContent =
  | { type: "text"; text: string }
  | { type: "image" | "video" | "audio" | "url"; mime_type: string; file_uri: string };
```

### `run` request body

```ts
{
  content: MessageContent[];
  variables?: Record<string, unknown>;
  deploymentId?: string;
}
```

`run` response (common fields):

```ts
{
  content: string | Record<string, unknown>;
  model?: string;
  input_tokens?: number;
  output_tokens?: number;
  [key: string]: unknown;
}
```

### `stream` request body

Same as `run`, plus optional `signal`.

### `conversation.start`

```ts
start(conversationId?: string, deploymentId?: string): void
```

Behavior:
- Sets active conversation context for future conversation calls.
- If `conversationId` is omitted, next `conversation.run/stream` creates a fresh conversation.
- If `deploymentId` is omitted, conversation context keeps previous deployment id (or init default).

### `conversation.run` / `conversation.stream` request body

```ts
{
  content: MessageContent[];
  historyLimit?: number;
  signal?: AbortSignal;
  variables?: Record<string, unknown>; // fresh-conversation only
  meta?: Record<string, string | number | boolean>; // fresh-conversation only
}
```

Conversation behavior contract:
- Fresh conversation (no active `conversation.id`):
  - `run`/`stream` creates conversation using `/conversation`.
  - `variables` and `meta` are accepted.
- Existing conversation (active `conversation.id`):
  - `run` continues via non-stream conversation endpoint.
  - `stream` continues via stream conversation endpoint.
  - `variables` and `meta` are rejected with validation error.

### Response highlights

- `content`: model output (string or structured object depending on deployment behavior)
- `conversation_id`: conversation identifier for conversation APIs
- `model`: model identifier used
- `input_tokens` / `output_tokens`: token usage
- `created_at` / `updated_at`: timestamps when present

### `conversation` state fields

```ts
{
  id: string | null;
  deploymentId: string | null;
  status: "idle" | "loading" | "streaming" | "success" | "error";
  data: ConversationData | null;
  live: string;
  error: AmarsiaSdkErrorData | null;
  meta: UsageMetadata | null;
  raw: unknown;
  messages: ConversationMessage[];
  messagesPageInfo: { page: number; page_size: number; total: number; has_more: boolean } | null;
  conversations: Array<Record<string, unknown>>;
  conversationsPageInfo: { page: number; page_size: number; total: number; has_more: boolean } | null;
}
```

### History/query helpers

```ts
conversation.loadMessages({ page?, pageSize?, append? });
conversation.list({ page?, pageSize?, meta? });
```

See full examples and endpoint docs at [docs.amarsia.com](https://docs.amarsia.com).

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

## FAQ

### Is this the official Amarsia SDK?

Yes. `@amarsia/sdk` is the official SDK for Amarsia APIs.

### Does it support streaming AI responses?

Yes. Use `client.stream(...)` for streaming output and `client.conversation.stream(...)` for stateful streaming conversation continuation.

### Should I use this with React?

For raw SDK usage, use `@amarsia/sdk` directly. For React hooks with no manual `useState/useEffect` wiring, use [@amarsia/react](https://www.npmjs.com/package/@amarsia/react).

### Search terms

Amarsia SDK, Amarsia TypeScript SDK, Amarsia JavaScript SDK, Amarsia conversation API SDK, Amarsia streaming API SDK.
