import {
  continueConversation,
  continueConversationStream,
  createConversation,
  getConversationMessages,
  listConversations,
  resumeConversationV2,
  runConversationV2
} from "./apis/conversation";
import { runRequest } from "./apis/run";
import { streamRequest } from "./apis/stream";
import { createTrigger, getTrigger } from "./apis/trigger";
import { createHttpClient } from "./core/http";
import { setIfDefined } from "./core/object";
import { createStore } from "./core/store";
import { createConfigError, createValidationError, toErrorData, wrapUnknownError } from "./errors";
import type {
  AmarsiaSdkErrorData,
  ClientToolResult,
  ConversationData,
  CreateTriggerRequest,
  TriggerData,
  ConversationLoadMessagesOptions,
  ConversationRunOptions,
  ConversationStreamOptions,
  ConversationState,
  InitConfig,
  ListConversationsRequest,
  LoadMessagesRequest,
  MessageContent,
  RunRequest,
  RunResponse,
  StatefulResult,
  StreamRequest,
  StreamResponse,
  Subscription,
  UsageMetadata
} from "./types";

type StatefulBindings<TData> = {
  readonly status: StatefulResult<TData>["status"];
  readonly data: TData | null;
  readonly live: string;
  readonly error: AmarsiaSdkErrorData | null;
  readonly meta: UsageMetadata | null;
  readonly raw: unknown;
  getState: () => Readonly<StatefulResult<TData>>;
  subscribe: (listener: Subscription<StatefulResult<TData>>) => () => void;
  reset: () => void;
};

export type RunController = ((request: RunRequest) => Promise<RunResponse>) & StatefulBindings<RunResponse>;

export type StreamController = ((request: StreamRequest) => Promise<StreamResponse>) &
  StatefulBindings<StreamResponse> & {
    abort: () => void;
  };

export type ConversationController = {
  readonly id: string | null;
  readonly deploymentId: string | null;
  readonly status: ConversationState["status"];
  readonly data: ConversationData | null;
  readonly live: string;
  readonly error: AmarsiaSdkErrorData | null;
  readonly meta: UsageMetadata | null;
  readonly raw: unknown;
  readonly messages: ConversationState["messages"];
  readonly messagesPageInfo: ConversationState["messagesPageInfo"];
  readonly conversations: ConversationState["conversations"];
  readonly conversationsPageInfo: ConversationState["conversationsPageInfo"];
  readonly pendingToolCalls: ConversationState["pendingToolCalls"];
  getState: () => Readonly<ConversationState>;
  subscribe: (listener: Subscription<ConversationState>) => () => void;
  run: (options: ConversationRunOptions) => Promise<ConversationData>;
  stream: (options: ConversationStreamOptions) => Promise<ConversationData>;
  loadMessages: (input?: ConversationLoadMessagesOptions) => Promise<ConversationState["messages"]>;
  list: (input?: ListConversationsRequest) => Promise<ConversationState["conversations"]>;
  start: (conversationId?: string, deploymentId?: string) => void;
  abort: () => void;
};

export type TriggerController = {
  create: (input: CreateTriggerRequest) => Promise<TriggerData>;
  get: (input: { deploymentId?: string; triggerId: string }) => Promise<TriggerData>;
};

export type AmarsiaClient = {
  run: RunController;
  stream: StreamController;
  conversation: ConversationController;
  trigger: TriggerController;
};

export function createAmarsiaClient(config: InitConfig): AmarsiaClient {
  const httpClient = createHttpClient(config);

  const runStore = createStore<StatefulResult<RunResponse>>(initialState<RunResponse>());
  const streamStore = createStore<StatefulResult<StreamResponse>>(initialState<StreamResponse>());
  const conversationStore = createStore<ConversationState>({
    ...initialState<ConversationData>(),
    id: null,
    deploymentId: config.deploymentId ?? null,
    messages: [],
    messagesPageInfo: null,
    conversations: [],
    conversationsPageInfo: null,
    pendingToolCalls: []
  });

  let streamAbortController: AbortController | null = null;
  let conversationAbortController: AbortController | null = null;

  const run = (async (request: RunRequest): Promise<RunResponse> => {
    validateMessageContent(request.content);
    runStore.setState((previous) => ({
      ...previous,
      status: "loading",
      error: null,
      live: ""
    }));

    try {
      const response = await runRequest(httpClient, request);
      const meta = extractUsageMeta(response.data);
      runStore.setState((previous) => ({
        ...previous,
        status: "success",
        data: response.data,
        raw: response.raw,
        meta
      }));
      return response.data;
    } catch (error) {
      const wrapped = wrapUnknownError(error);
      runStore.setState((previous) => ({
        ...previous,
        status: "error",
        error: toErrorData(wrapped)
      }));
      throw wrapped;
    }
  }) as RunController;

  bindStateful(run, runStore, () => initialState<RunResponse>());

  const stream = (async (request: StreamRequest): Promise<StreamResponse> => {
    validateMessageContent(request.content);
    streamAbortController?.abort();
    streamAbortController = new AbortController();
    const signal = mergeAbortSignals(request.signal, streamAbortController.signal);

    streamStore.setState((previous) => ({
      ...previous,
      status: "streaming",
      error: null,
      live: "",
      data: null
    }));

    try {
      const response = await streamRequest(
        httpClient,
        {
          ...request,
          signal
        },
        {
          onChunk: (chunk) => {
            streamStore.setState((previous) => ({
              ...previous,
              live: `${previous.live}${chunk}`
            }));
          }
        }
      );

      const meta = extractUsageMeta(response.data);
      streamStore.setState((previous) => ({
        ...previous,
        status: "success",
        data: response.data,
        raw: response.raw,
        meta,
        live: ""
      }));

      return response.data;
    } catch (error) {
      const wrapped = wrapUnknownError(error);
      streamStore.setState((previous) => ({
        ...previous,
        status: "error",
        error: toErrorData(wrapped)
      }));
      throw wrapped;
    } finally {
      streamAbortController = null;
    }
  }) as StreamController;

  bindStateful(stream, streamStore, () => initialState<StreamResponse>());
  stream.abort = (): void => {
    streamAbortController?.abort();
    streamAbortController = null;
  };

  const conversation: ConversationController = {
    get id() {
      return conversationStore.getState().id;
    },
    get deploymentId() {
      return conversationStore.getState().deploymentId;
    },
    get status() {
      return conversationStore.getState().status;
    },
    get data() {
      return conversationStore.getState().data;
    },
    get live() {
      return conversationStore.getState().live;
    },
    get error() {
      return conversationStore.getState().error;
    },
    get meta() {
      return conversationStore.getState().meta;
    },
    get raw() {
      return conversationStore.getState().raw;
    },
    get messages() {
      return conversationStore.getState().messages;
    },
    get messagesPageInfo() {
      return conversationStore.getState().messagesPageInfo;
    },
    get conversations() {
      return conversationStore.getState().conversations;
    },
    get conversationsPageInfo() {
      return conversationStore.getState().conversationsPageInfo;
    },
    get pendingToolCalls() {
      return conversationStore.getState().pendingToolCalls;
    },
    getState() {
      return conversationStore.getState();
    },
    subscribe(listener) {
      return conversationStore.subscribe(listener);
    },
    /**
     * Sets a fresh conversation context or binds to an existing conversation id.
     * Pass `conversationId` when you want to resume an existing thread.
     */
    start(conversationId, deploymentId) {
      conversationAbortController?.abort();
      conversationAbortController = null;
      conversationStore.setState((previous) => ({
        ...initialState<ConversationData>(),
        id: conversationId ?? null,
        deploymentId: deploymentId ?? previous.deploymentId,
        messages: [],
        messagesPageInfo: null,
        conversations: previous.conversations,
        conversationsPageInfo: previous.conversationsPageInfo,
        pendingToolCalls: []
      }));
    },
    abort() {
      conversationAbortController?.abort();
      conversationAbortController = null;
    },
    async run(options: ConversationRunOptions) {
      validateMessageContent(options.content);
      conversationAbortController?.abort();
      conversationAbortController = new AbortController();
      const signal = mergeAbortSignals(options.signal, conversationAbortController.signal);

      conversationStore.setState((previous) => ({
        ...previous,
        status: "loading",
        error: null,
        live: "",
        data: null,
        pendingToolCalls: []
      }));

      try {
        const currentState = conversationStore.getState();
        const request = {
          content: options.content,
          signal
        } as {
          content: MessageContent[];
          deploymentId?: string;
          signal: AbortSignal;
          variables?: Record<string, unknown>;
          meta?: Record<string, string | number | boolean>;
          historyLimit?: number;
          clientCapabilities?: string[];
          triggerId?: string;
        };

        setIfDefined(request, "deploymentId", currentState.deploymentId ?? undefined);
        setIfDefined(request, "historyLimit", options.historyLimit);

        const activeConversationId = currentState.id;
        if (options.clientTools && Object.keys(options.clientTools).length > 0) {
          if (activeConversationId && (options.variables !== undefined || options.meta !== undefined || options.triggerId !== undefined)) {
            throw createValidationError(
              "`variables`, `meta`, and `triggerId` are only supported when starting a new conversation (no active conversation id)."
            );
          }

          setIfDefined(request, "variables", activeConversationId ? undefined : options.variables);
          setIfDefined(request, "meta", activeConversationId ? undefined : options.meta);
          setIfDefined(request, "triggerId", activeConversationId ? undefined : options.triggerId);
          request.clientCapabilities = Object.keys(options.clientTools);

          let response = await runConversationV2(httpClient, request, activeConversationId ?? undefined);
          let conversationId = response.data.conversation_id;

          while (response.data.status === "requires_client_action") {
            const calls = response.data.client_tool_calls ?? [];
            const runId = response.data.run_id;
            if (!runId) {
              throw createValidationError("Client tool response is missing `run_id`.");
            }

            conversationStore.setState((previous) => ({
              ...previous,
              status: "awaiting_input",
              id: conversationId,
              data: response.data,
              raw: response.raw,
              meta: extractUsageMeta(response.data),
              pendingToolCalls: calls
            }));

            const toolResults: ClientToolResult[] = [];
            for (const call of calls) {
              const handler = options.clientTools[call.name];
              if (!handler) {
                throw createConfigError(
                  `Conversation requested client tool "${call.name}", but no handler was provided.`
                );
              }
              try {
                const output = await handler(call.arguments, call);
                toolResults.push({ call_id: call.call_id, output });
              } catch (error) {
                toolResults.push({
                  call_id: call.call_id,
                  output: {
                    error: error instanceof Error ? error.message : String(error)
                  }
                });
              }
            }

            conversationStore.setState((previous) => ({
              ...previous,
              status: "loading",
              pendingToolCalls: []
            }));
            response = await resumeConversationV2(
              httpClient,
              request,
              conversationId,
              runId,
              toolResults
            );
            conversationId = response.data.conversation_id;
          }

          const meta = extractUsageMeta(response.data);
          conversationStore.setState((previous) => ({
            ...previous,
            status: "success",
            id: conversationId,
            data: response.data,
            raw: response.raw,
            meta,
            live: "",
            pendingToolCalls: []
          }));
          return response.data;
        }

        if (!activeConversationId) {
          setIfDefined(request, "variables", options.variables);
          setIfDefined(request, "meta", options.meta);
          setIfDefined(request, "triggerId", options.triggerId);

          const created = await createConversation(httpClient, request);

          const conversationId = created.data.conversation_id;
          const meta = extractUsageMeta(created.data);
          conversationStore.setState((previous) => ({
            ...previous,
            status: "success",
            id: conversationId,
            data: created.data,
            raw: created.raw,
            meta,
            live: ""
          }));
          return created.data;
        }

        if (options.variables !== undefined || options.meta !== undefined || options.triggerId !== undefined) {
          throw createValidationError(
            "`variables`, `meta`, and `triggerId` are only supported when starting a new conversation (no active conversation id)."
          );
        }

        const continued = await continueConversation(httpClient, request, activeConversationId);

        const meta = extractUsageMeta(continued.data);
        conversationStore.setState((previous) => ({
          ...previous,
          status: "success",
          id: activeConversationId,
          data: continued.data,
          raw: continued.raw,
          meta,
          live: ""
        }));
        return continued.data;
      } catch (error) {
        const wrapped = wrapUnknownError(error);
        conversationStore.setState((previous) => ({
          ...previous,
          status: "error",
          error: toErrorData(wrapped)
        }));
        throw wrapped;
      } finally {
        conversationAbortController = null;
      }
    },
    async stream(options: ConversationStreamOptions) {
      validateMessageContent(options.content);
      conversationAbortController?.abort();
      conversationAbortController = new AbortController();
      const signal = mergeAbortSignals(options.signal, conversationAbortController.signal);

      conversationStore.setState((previous) => ({
        ...previous,
        status: previous.id ? "streaming" : "loading",
        error: null,
        live: "",
        data: null,
        pendingToolCalls: []
      }));

      try {
        const currentState = conversationStore.getState();
        const request = {
          content: options.content,
          signal
        } as {
          content: MessageContent[];
          deploymentId?: string;
          signal: AbortSignal;
          variables?: Record<string, unknown>;
          meta?: Record<string, string | number | boolean>;
          historyLimit?: number;
          triggerId?: string;
        };

        setIfDefined(request, "deploymentId", currentState.deploymentId ?? undefined);
        setIfDefined(request, "historyLimit", options.historyLimit);

        const activeConversationId = currentState.id;
        if (!activeConversationId) {
          setIfDefined(request, "variables", options.variables);
          setIfDefined(request, "meta", options.meta);
          setIfDefined(request, "triggerId", options.triggerId);

          const created = await createConversation(httpClient, request);
          const conversationId = created.data.conversation_id;
          const meta = extractUsageMeta(created.data);
          conversationStore.setState((previous) => ({
            ...previous,
            status: "success",
            id: conversationId,
            data: created.data,
            raw: created.raw,
            meta,
            live: ""
          }));
          return created.data;
        }

        if (options.variables !== undefined || options.meta !== undefined || options.triggerId !== undefined) {
          throw createValidationError(
            "`variables`, `meta`, and `triggerId` are only supported when starting a new conversation (no active conversation id)."
          );
        }

        const continued = await continueConversationStream(
          httpClient,
          request,
          activeConversationId,
          {
            onChunk: (chunk) => {
              conversationStore.setState((previous) => ({
                ...previous,
                live: `${previous.live}${chunk}`
              }));
            }
          }
        );

        const meta = extractUsageMeta(continued.data);
        conversationStore.setState((previous) => ({
          ...previous,
          status: "success",
          id: activeConversationId,
          data: continued.data,
          raw: continued.raw,
          meta,
          live: ""
        }));
        return continued.data;
      } catch (error) {
        const wrapped = wrapUnknownError(error);
        conversationStore.setState((previous) => ({
          ...previous,
          status: "error",
          error: toErrorData(wrapped)
        }));
        throw wrapped;
      } finally {
        conversationAbortController = null;
      }
    },
    async loadMessages(input) {
      const conversationId = input?.conversationId ?? conversationStore.getState().id;
      if (!conversationId) {
        throw createConfigError(
          "No conversation id found. Pass `conversationId` or call conversation.start(conversationId), then retry."
        );
      }

      try {
        const request: LoadMessagesRequest = { conversationId };
        if (input?.page !== undefined) request.page = input.page;
        if (input?.pageSize !== undefined) request.pageSize = input.pageSize;

        const response = await getConversationMessages(httpClient, request);
        let nextMessages = response.data.items;
        if (input?.append) {
          const merged = [...conversationStore.getState().messages, ...response.data.items];
          const dedupedById = new Map<string, (typeof merged)[number]>();
          for (const message of merged) {
            dedupedById.set(message.id, message);
          }
          nextMessages = [...dedupedById.values()];
        }

        conversationStore.setState((previous) => ({
          ...previous,
          messages: nextMessages,
          messagesPageInfo: {
            page: response.data.page,
            page_size: response.data.page_size,
            total: response.data.total,
            has_more: response.data.has_more
          }
        }));
        return nextMessages;
      } catch (error) {
        const wrapped = wrapUnknownError(error);
        conversationStore.setState((previous) => ({
          ...previous,
          status: "error",
          error: toErrorData(wrapped)
        }));
        throw wrapped;
      }
    },
    async list(input) {
      try {
        const request: ListConversationsRequest = {};
        const deploymentId = conversationStore.getState().deploymentId;
        if (deploymentId !== null) request.deploymentId = deploymentId;
        if (input?.page !== undefined) request.page = input.page;
        if (input?.pageSize !== undefined) request.pageSize = input.pageSize;
        if (input?.meta !== undefined) request.meta = input.meta;

        const response = await listConversations(httpClient, request);
        conversationStore.setState((previous) => ({
          ...previous,
          conversations: response.data.items,
          conversationsPageInfo: {
            page: response.data.page,
            page_size: response.data.page_size,
            total: response.data.total,
            has_more: response.data.has_more
          }
        }));
        return response.data.items;
      } catch (error) {
        const wrapped = wrapUnknownError(error);
        conversationStore.setState((previous) => ({
          ...previous,
          status: "error",
          error: toErrorData(wrapped)
        }));
        throw wrapped;
      }
    }
  };

  const trigger: TriggerController = {
    create: async (input) => {
      const response = await createTrigger(httpClient, input);
      return response.data;
    },
    get: async (input) => {
      const response = await getTrigger(httpClient, input);
      return response.data;
    }
  };

  return {
    run,
    stream,
    conversation,
    trigger
  };
}

function bindStateful<TData>(
  target: StatefulBindings<TData>,
  store: ReturnType<typeof createStore<StatefulResult<TData>>>,
  resetFactory: () => StatefulResult<TData>
): void {
  Object.defineProperties(target, {
    status: { get: () => store.getState().status },
    data: { get: () => store.getState().data },
    live: { get: () => store.getState().live },
    error: { get: () => store.getState().error },
    meta: { get: () => store.getState().meta },
    raw: { get: () => store.getState().raw }
  });

  target.getState = (): Readonly<StatefulResult<TData>> => store.getState();
  target.subscribe = (listener: Subscription<StatefulResult<TData>>): (() => void) => store.subscribe(listener);
  target.reset = (): void => {
    store.setState(() => resetFactory());
  };
}

function initialState<TData>(): StatefulResult<TData> {
  return {
    status: "idle",
    data: null,
    live: "",
    error: null,
    meta: null,
    raw: null
  };
}

function extractUsageMeta(data: Record<string, unknown>): UsageMetadata | null {
  const meta: UsageMetadata = {};

  if (typeof data.model === "string") meta.model = data.model;
  if (typeof data.input_tokens === "number") meta.input_tokens = data.input_tokens;
  if (typeof data.output_tokens === "number") meta.output_tokens = data.output_tokens;
  if (typeof data.request_id === "string") meta.request_id = data.request_id;

  return Object.keys(meta).length > 0 ? meta : null;
}

function validateMessageContent(content: MessageContent[]): void {
  if (!Array.isArray(content) || content.length === 0) {
    throw createValidationError("`content` must be a non-empty array of message content parts.");
  }

  for (const part of content) {
    if (part.type === "text") {
      if (typeof part.text !== "string" || part.text.trim() === "") {
        throw createValidationError("Text content must include non-empty `text`.");
      }
      continue;
    }

    if (typeof part.mime_type !== "string" || part.mime_type.trim() === "") {
      throw createValidationError("File content must include non-empty `mime_type`.");
    }
    if (typeof part.file_uri !== "string" || part.file_uri.trim() === "") {
      throw createValidationError("File content must include non-empty `file_uri`.");
    }
  }
}

function mergeAbortSignals(primary: AbortSignal | undefined, secondary: AbortSignal): AbortSignal {
  if (!primary) return secondary;
  if (primary.aborted) return primary;

  const merged = new AbortController();
  const abort = (): void => merged.abort();
  primary.addEventListener("abort", abort, { once: true });
  secondary.addEventListener("abort", abort, { once: true });
  return merged.signal;
}


