# @amarsia/sdk

## 1.2.3

### Patch Changes

- fcf3df7: fix: bind globalThis.fetch when used as the default to prevent "Illegal invocation" in browsers

## 1.2.2

### Patch Changes

- cb6f929: Update conversation list endpoint to include deployment_id in SDK

## 1.2.1

### Patch Changes

- aba41d0: Improve conversation resume/history ergonomics by allowing loadMessages to accept an explicit conversationId, clarify start(...) resume behavior, and update SDK docs with resume and history-by-id examples.

## 1.2.0

### Minor Changes

- 68f21f7: Allow keyless SDK calls for public workflows and improve error handling so users get clear status/code/message across run/stream/conversation methods.

## 1.1.0

### Minor Changes

- 53c0ebb: feat: API reference and mutation restructure

## 1.0.0

### Major Changes

- 4235f32: First stable release of @amarsia/sdk and @amarsia/react with production-ready conversation and streaming APIs.

## 0.1.1

### Patch Changes

- 12afd99: Bootstrap monorepo package foundation with TypeScript build configuration and release automation scaffolding for sdk and react packages.
