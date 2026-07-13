import { getAgentHistory, resumeConversationV2, runConversationV2 } from "./conversation";
import { setIfDefined } from "../core/object";
import { createStore } from "../core/store";
import {
  AmarsiaSdkError,
  createConfigError,
  createValidationError,
  toErrorData,
  wrapUnknownError
} from "../errors";
import type { HttpClient } from "../core/http";
import type {
  AgentClientTools,
  AgentContinueOptions,
  AgentGetOptions,
  AgentHistoryItem,
  AgentHistoryResponse,
  AgentLoadMoreHistoryOptions,
  AgentLoadMoreMessagesOptions,
  AgentOpenOptions,
  AgentPendingToolCall,
  AgentStartOptions,
  AgentState,
  AgentToolSummary,
  ClientCapability,
  ClientToolCall,
  ClientToolResult,
  ConversationData,
  ConversationSendRequest,
  Subscription
} from "../types";

export type AgentController = {
  readonly conversationId: string | null;
  readonly conversationStatus: string | null;
  readonly completedAt: string | null;
  readonly runId: string | null;
  readonly runStatus: string | null;
  readonly history: AgentState["history"];
  readonly historyPageInfo: AgentState["historyPageInfo"];
  readonly messages: AgentState["messages"];
  readonly messagesPageInfo: AgentState["messagesPageInfo"];
  readonly progress: AgentState["progress"];
  readonly toolSummary: AgentState["toolSummary"];
  readonly pendingToolCalls: AgentState["pendingToolCalls"];
  readonly status: AgentState["status"];
  readonly error: AgentState["error"];
  getState: () => Readonly<AgentState>;
  subscribe: (listener: Subscription<AgentState>) => () => void;
  start: (options: AgentStartOptions) => Promise<Readonly<AgentState>>;
  get: (conversationId: string, options?: AgentGetOptions) => Promise<Readonly<AgentState>>;
  open: (conversationId: string, options?: AgentOpenOptions) => Promise<Readonly<AgentState>>;
  loadMoreMessages: (
    options?: AgentLoadMoreMessagesOptions
  ) => Promise<Readonly<AgentState>>;
  loadMoreHistory: (
    options?: AgentLoadMoreHistoryOptions
  ) => Promise<Readonly<AgentState>>;
  continue: (options?: AgentContinueOptions) => Promise<Readonly<AgentState>>;
  resolveTool: (callId: string, output: Record<string, unknown>) => Promise<Readonly<AgentState>>;
  close: () => void;
  abort: () => void;
};

const DEFAULT_POLL_INTERVAL_MS = 2_000;
const MIN_POLL_INTERVAL_MS = 500;
const MAX_POLL_INTERVAL_MS = 60_000;
const AGENT_HISTORY_PAGE_SIZE = 100;

export function createAgentController(client: HttpClient): AgentController {
  const store = createStore<AgentState>(initialAgentState());
  const handledCallIds = new Set<string>();
  const resolvedOutputs = new Map<string, Record<string, unknown>>();

  let clientTools: AgentClientTools = {};
  let deploymentId: string | undefined;
  let pollIntervalMs = DEFAULT_POLL_INTERVAL_MS;
  let historyPageSize = AGENT_HISTORY_PAGE_SIZE;
  let pollTimer: ReturnType<typeof setTimeout> | null = null;
  let lifecycleController: AbortController | null = null;
  let requestInFlight = false;
  let resultSubmissionInFlight = false;

  const stopPolling = (): void => {
    if (pollTimer !== null) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
  };

  const schedulePoll = (): void => {
    stopPolling();
    const state = store.getState();
    if (
      state.status === "closed" ||
      state.conversationStatus === "completed" ||
      lifecycleController?.signal.aborted
    ) {
      return;
    }
    pollTimer = setTimeout(() => {
      pollTimer = null;
      void refresh().finally(schedulePoll);
    }, pollIntervalMs);
  };

  const updateFromHistory = (
    response: AgentHistoryResponse,
    options?: {
      history?: AgentState["history"];
      historyPageInfo?: AgentState["historyPageInfo"];
      messages?: AgentState["messages"];
      messagesPageInfo?: AgentState["messagesPageInfo"];
    }
  ): void => {
    const previousState = store.getState();
    const conversationStatus = response.conversation_status ?? previousState.conversationStatus ?? "active";
    const pendingToolCalls = normalizeToolCalls(response.pending_client_actions ?? []);
    const history = options?.history ?? response.items;
    const messages = options?.messages ?? messagesFromHistory(history);
    const toolSummary = toolSummariesFromHistory(history);
    store.setState((previous) => ({
      ...previous,
      conversationStatus,
      completedAt: response.completed_at ?? null,
      runId: response.run_id ?? null,
      runStatus: response.run_status ?? null,
      history,
      historyPageInfo:
        options?.historyPageInfo ?? {
          nextCursor: response.next_cursor ?? null,
          hasMore: Boolean(response.next_cursor)
        },
      messages,
      messagesPageInfo:
        options?.messagesPageInfo ?? {
          page: 1,
          pageSize: messages.length,
          total: messages.length,
          hasMore: Boolean(response.next_cursor)
        },
      progress: previous.progress,
      toolSummary,
      pendingToolCalls,
      status: statusFromLifecycle(conversationStatus, response.run_status, pendingToolCalls),
      error: null
    }));
    pruneResolvedOutputs(resolvedOutputs, pendingToolCalls);
    if (conversationStatus === "completed") stopPolling();
    invokeAvailableHandlers();
  };

  const updateFromRun = (response: ConversationData): void => {
    const pendingToolCalls = normalizeToolCalls(response.client_tool_calls ?? []);
    store.setState((previous) => ({
      ...previous,
      conversationId: response.conversation_id,
      conversationStatus: response.conversation_status ?? previous.conversationStatus ?? "active",
      completedAt: response.completed_at ?? previous.completedAt,
      runId: response.run_id ?? previous.runId,
      runStatus: response.run_status ?? previous.runStatus,
      progress: response.progress ?? previous.progress,
      pendingToolCalls,
      status:
        response.conversation_status === "completed"
          ? "success"
          : response.run_status === "waiting_for_client_action"
            ? "awaiting_input"
            : response.run_status === "running"
              ? "running"
              : response.run_status === "failed" ||
                  response.run_status === "interrupted" ||
                  response.run_status === "expired"
                ? "error"
            : "success",
      error: null
    }));
    pruneResolvedOutputs(resolvedOutputs, pendingToolCalls);
    invokeAvailableHandlers();
  };

  const refresh = async (): Promise<Readonly<AgentState>> => {
    const conversationId = store.getState().conversationId;
    const activeController = lifecycleController;
    if (!conversationId || requestInFlight || !activeController || activeController.signal.aborted) {
      return store.getState();
    }
    requestInFlight = true;
    try {
      const firstResponse = await getAgentHistory(client, {
        conversationId,
        limit: historyPageSize,
        signal: activeController.signal,
        ...(deploymentId ? { deploymentId } : {})
      });
      const items = [...firstResponse.data.items];
      const existingHistory = store.getState().history;

      if (lifecycleController === activeController && !activeController.signal.aborted) {
        if (existingHistory.length > 0) {
          const latestIds = new Set(items.map((item) => item.id));
          items.unshift(...existingHistory.filter((item) => !latestIds.has(item.id)));
        }
        items.sort(compareHistoryItems);
        updateFromHistory(firstResponse.data, {
          history: items,
          historyPageInfo:
            store.getState().historyPageInfo ?? {
              nextCursor: firstResponse.data.next_cursor ?? null,
              hasMore: Boolean(firstResponse.data.next_cursor)
            }
        });
      }
      return store.getState();
    } catch (error) {
      const wrapped = wrapUnknownError(error);
      if (
        lifecycleController === activeController &&
        !activeController.signal.aborted &&
        wrapped.name !== "AmarsiaAbortError"
      ) {
        store.setState((previous) => ({
          ...previous,
          status: "error",
          error: toErrorData(wrapped)
        }));
      }
      return store.getState();
    } finally {
      requestInFlight = false;
    }
  };

  const submitResolvedTools = async (): Promise<Readonly<AgentState>> => {
    if (resultSubmissionInFlight) return store.getState();
    const state = store.getState();
    if (
      state.conversationStatus === "completed" ||
      !state.conversationId ||
      state.pendingToolCalls.length === 0
    ) {
      return state;
    }
    if (!state.pendingToolCalls.every((call) => resolvedOutputs.has(call.callId))) {
      return state;
    }

    const toolResults: ClientToolResult[] = state.pendingToolCalls.map((call) => ({
      call_id: call.callId,
      output: resolvedOutputs.get(call.callId) as Record<string, unknown>
    }));

    resultSubmissionInFlight = true;
    let submitNextRound = false;
    const activeController = lifecycleController;
    if (!activeController || activeController.signal.aborted) {
      resultSubmissionInFlight = false;
      return store.getState();
    }
    stopPolling();
    store.setState((previous) => ({ ...previous, status: "running", error: null }));
    try {
      const request: ConversationSendRequest = {
        content: [],
        clientCapabilities: capabilitiesFromTools(clientTools)
      };
      setIfDefined(request, "deploymentId", deploymentId);
      setIfDefined(request, "signal", activeController.signal);
      const response = await resumeConversationV2(
        client,
        request,
        state.conversationId,
        toolResults
      );
      if (lifecycleController !== activeController || activeController.signal.aborted) return store.getState();
      toolResults.forEach((result) => resolvedOutputs.delete(result.call_id));
      updateFromRun(response.data);
      await refresh();
      const nextState = store.getState();
      submitNextRound =
        nextState.pendingToolCalls.length > 0 &&
        nextState.pendingToolCalls.every((call) => resolvedOutputs.has(call.callId));
      schedulePoll();
      return store.getState();
    } catch (error) {
      const wrapped = wrapUnknownError(error);
      if (lifecycleController !== activeController || activeController.signal.aborted) {
        return store.getState();
      }
      if (isConflict(wrapped)) {
        await refresh();
        schedulePoll();
        return store.getState();
      }
      store.setState((previous) => ({
        ...previous,
        status: "error",
        error: toErrorData(wrapped)
      }));
      schedulePoll();
      throw wrapped;
    } finally {
      resultSubmissionInFlight = false;
      if (submitNextRound) void submitResolvedTools();
    }
  };

  const invokeAvailableHandlers = (): void => {
    const state = store.getState();
    if (state.conversationStatus === "completed" || !state.conversationId) return;

    for (const call of state.pendingToolCalls) {
      const handler = clientTools[call.name];
      if (!handler || handledCallIds.has(call.callId)) continue;
      handledCallIds.add(call.callId);
      const signal = lifecycleController?.signal ?? new AbortController().signal;
      void Promise.resolve()
        .then(() =>
          handler(call.arguments, {
            callId: call.callId,
            name: call.name,
            conversationId: state.conversationId as string,
            signal
          })
        )
        .catch((error: unknown) => ({
          error: error instanceof Error ? error.message : String(error)
        }))
        .then((output) => {
          if (signal.aborted) return;
          resolvedOutputs.set(call.callId, output);
          void submitResolvedTools();
        });
    }
  };

  const beginLifecycle = (options?: AgentOpenOptions): void => {
    stopPolling();
    lifecycleController?.abort();
    const nextController = new AbortController();
    lifecycleController = nextController;
    clientTools = options?.clientTools ?? {};
    deploymentId = options?.deploymentId;
    pollIntervalMs = clampPollInterval(options?.pollIntervalMs);
    historyPageSize = clampPageSize(
      options?.historyPageSize ?? options?.messagePageSize
    );
    if (options?.signal) {
      if (options.signal.aborted) nextController.abort();
      else options.signal.addEventListener("abort", () => nextController.abort(), { once: true });
    }
    handledCallIds.clear();
    resolvedOutputs.clear();
  };

  const controller: AgentController = {
    get conversationId() {
      return store.getState().conversationId;
    },
    get conversationStatus() {
      return store.getState().conversationStatus;
    },
    get completedAt() {
      return store.getState().completedAt;
    },
    get runId() {
      return store.getState().runId;
    },
    get runStatus() {
      return store.getState().runStatus;
    },
    get history() {
      return store.getState().history;
    },
    get historyPageInfo() {
      return store.getState().historyPageInfo;
    },
    get messages() {
      return store.getState().messages;
    },
    get messagesPageInfo() {
      return store.getState().messagesPageInfo;
    },
    get progress() {
      return store.getState().progress;
    },
    get toolSummary() {
      return store.getState().toolSummary;
    },
    get pendingToolCalls() {
      return store.getState().pendingToolCalls;
    },
    get status() {
      return store.getState().status;
    },
    get error() {
      return store.getState().error;
    },
    getState: store.getState,
    subscribe: store.subscribe,
    async start(options) {
      if (
        (!Array.isArray(options.content) || options.content.length === 0) &&
        (!options.triggerId || options.conversationId)
      ) {
        throw createValidationError(
          "`content` must be provided unless `triggerId` is starting a new conversation."
        );
      }
      const lifecycleOptions: AgentOpenOptions = {};
      setIfDefined(lifecycleOptions, "deploymentId", options.deploymentId);
      setIfDefined(lifecycleOptions, "clientTools", options.clientTools);
      setIfDefined(lifecycleOptions, "pollIntervalMs", options.pollIntervalMs);
      setIfDefined(lifecycleOptions, "historyPageSize", options.historyPageSize);
      setIfDefined(lifecycleOptions, "messagePageSize", options.messagePageSize);
      setIfDefined(lifecycleOptions, "signal", options.signal);
      beginLifecycle(lifecycleOptions);
      const activeController = lifecycleController as AbortController;
      store.setState(() => ({
        ...initialAgentState(),
        conversationId: options.conversationId ?? null,
        status: "loading"
      }));
      try {
        const request: ConversationSendRequest = {
          content: options.content ?? [],
          clientCapabilities: capabilitiesFromTools(clientTools)
        };
        setIfDefined(request, "deploymentId", deploymentId);
        setIfDefined(request, "variables", options.variables);
        setIfDefined(request, "meta", options.meta);
        setIfDefined(request, "historyLimit", options.historyLimit);
        setIfDefined(request, "triggerId", options.triggerId);
        setIfDefined(request, "signal", activeController.signal);
        const response = await runConversationV2(client, request, options.conversationId);
        if (lifecycleController !== activeController || activeController.signal.aborted) return store.getState();
        updateFromRun(response.data);
        await refresh();
        schedulePoll();
        return store.getState();
      } catch (error) {
        const wrapped = wrapUnknownError(error);
        if (lifecycleController !== activeController || activeController.signal.aborted) throw wrapped;
        if (options.conversationId && isConflict(wrapped)) {
          await refresh();
          schedulePoll();
          return store.getState();
        }
        store.setState((previous) => ({ ...previous, status: "error", error: toErrorData(wrapped) }));
        throw wrapped;
      }
    },
    async get(conversationId, options) {
      if (!conversationId.trim()) throw createValidationError("`conversationId` is required.");
      const response = await getAgentHistory(client, {
        conversationId,
        limit: clampPageSize(options?.pageSize),
        ...((options?.deploymentId ?? deploymentId)
          ? { deploymentId: (options?.deploymentId ?? deploymentId) as string }
          : {}),
        ...(options?.signal ? { signal: options.signal } : {})
      });
      return stateFromHistory(conversationId, response.data);
    },
    async open(conversationId, options) {
      if (!conversationId.trim()) throw createValidationError("`conversationId` is required.");
      beginLifecycle(options);
      store.setState(() => ({
        ...initialAgentState(),
        conversationId,
        status: "loading"
      }));
      await refresh();
      schedulePoll();
      return store.getState();
    },
    async loadMoreMessages(options) {
      const state = store.getState();
      if (!state.conversationId) {
        throw createConfigError("No agent conversation is open. Call agent.start(...) or agent.open(...) first.");
      }
      if (!state.historyPageInfo?.nextCursor) return state;
      const activeController = lifecycleController;
      if (!activeController || activeController.signal.aborted) {
        throw createConfigError("The agent is closed. Call agent.start(...) or agent.open(...) first.");
      }
      const response = await getAgentHistory(client, {
        conversationId: state.conversationId,
        cursor: state.historyPageInfo.nextCursor,
        limit: clampPageSize(options?.pageSize ?? historyPageSize),
        signal: options?.signal ?? activeController.signal,
        ...(deploymentId ? { deploymentId } : {})
      });
      const existingIds = new Set(state.history.map((item) => item.id));
      const history = [
        ...response.data.items.filter((item) => !existingIds.has(item.id)),
        ...state.history
      ].sort(compareHistoryItems);
      updateFromHistory(response.data, {
        history,
        historyPageInfo: {
          nextCursor: response.data.next_cursor ?? null,
          hasMore: Boolean(response.data.next_cursor)
        }
      });
      return store.getState();
    },
    async loadMoreHistory(options) {
      return controller.loadMoreMessages(options);
    },
    async continue(options) {
      const state = store.getState();
      if (!state.conversationId) {
        throw createConfigError("No agent conversation is open. Call agent.start(...) or agent.open(...) first.");
      }
      if (state.conversationStatus === "completed") {
        throw createValidationError("The conversation is completed and cannot be continued.");
      }
      const content = options?.content ?? [{ type: "text" as const, text: "Continue." }];
      if (!Array.isArray(content) || content.length === 0) {
        throw createValidationError("`content` must be a non-empty array of message content parts.");
      }
      stopPolling();
      const activeController = lifecycleController;
      if (!activeController || activeController.signal.aborted) {
        throw createConfigError("The agent is closed. Call agent.start(...) or agent.open(...) first.");
      }
      store.setState((previous) => ({ ...previous, status: "loading", error: null }));
      try {
        const request: ConversationSendRequest = {
          content,
          clientCapabilities: capabilitiesFromTools(clientTools)
        };
        setIfDefined(request, "deploymentId", deploymentId);
        setIfDefined(request, "historyLimit", options?.historyLimit);
        setIfDefined(request, "signal", activeController.signal);
        const response = await runConversationV2(client, request, state.conversationId);
        if (lifecycleController !== activeController || activeController.signal.aborted) return store.getState();
        updateFromRun(response.data);
        await refresh();
        schedulePoll();
        return store.getState();
      } catch (error) {
        const wrapped = wrapUnknownError(error);
        if (lifecycleController !== activeController || activeController.signal.aborted) throw wrapped;
        if (isConflict(wrapped)) {
          await refresh();
          schedulePoll();
          return store.getState();
        }
        store.setState((previous) => ({ ...previous, status: "error", error: toErrorData(wrapped) }));
        schedulePoll();
        throw wrapped;
      }
    },
    async resolveTool(callId, output) {
      if (!callId.trim()) throw createValidationError("A tool call id is required.");
      if (store.getState().conversationStatus === "completed") return store.getState();
      let call = store.getState().pendingToolCalls.find((candidate) => candidate.callId === callId);
      if (!call) {
        await refresh();
        call = store.getState().pendingToolCalls.find((candidate) => candidate.callId === callId);
        if (!call) return store.getState();
      }
      resolvedOutputs.set(call.callId, output);
      return submitResolvedTools();
    },
    close() {
      stopPolling();
      lifecycleController?.abort();
      lifecycleController = null;
      store.setState((previous) => ({ ...previous, status: "closed" }));
    },
    abort() {
      stopPolling();
      lifecycleController?.abort();
      lifecycleController = null;
      store.setState((previous) => ({ ...previous, status: "closed" }));
    }
  };

  return controller;
}

function initialAgentState(): AgentState {
  return {
    conversationId: null,
    conversationStatus: null,
    completedAt: null,
    runId: null,
    runStatus: null,
    history: [],
    historyPageInfo: null,
    messages: [],
    messagesPageInfo: null,
    progress: [],
    toolSummary: [],
    pendingToolCalls: [],
    status: "idle",
    error: null
  };
}

function normalizeToolCalls(calls: ClientToolCall[]): AgentPendingToolCall[] {
  return calls.map((call) => ({
    callId: call.call_id,
    name: call.name,
    arguments: call.arguments ?? {}
  }));
}

function capabilitiesFromTools(tools: AgentClientTools): ClientCapability[] {
  return Object.entries(tools).map(([name, handler]) =>
    handler.inputSchema ? { name, input_schema: handler.inputSchema } : name
  );
}

function statusFromLifecycle(
  conversationStatus: string,
  runStatus: string | null | undefined,
  pendingToolCalls: AgentPendingToolCall[]
): AgentState["status"] {
  if (conversationStatus === "completed") return "success";
  if (pendingToolCalls.length > 0 || runStatus === "waiting_for_client_action") return "awaiting_input";
  if (runStatus === "running") return "running";
  if (runStatus === "interrupted" || runStatus === "expired" || runStatus === "failed") return "error";
  return "success";
}

function clampPollInterval(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return DEFAULT_POLL_INTERVAL_MS;
  return Math.min(MAX_POLL_INTERVAL_MS, Math.max(MIN_POLL_INTERVAL_MS, Math.round(value)));
}

function clampPageSize(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return AGENT_HISTORY_PAGE_SIZE;
  return Math.min(100, Math.max(1, Math.round(value)));
}

function stateFromHistory(
  conversationId: string,
  response: AgentHistoryResponse
): Readonly<AgentState> {
  const pendingToolCalls = normalizeToolCalls(response.pending_client_actions ?? []);
  const conversationStatus = response.conversation_status ?? "active";
  const history = [...response.items].sort(compareHistoryItems);
  const messages = messagesFromHistory(history);
  return {
    ...initialAgentState(),
    conversationId,
    conversationStatus,
    completedAt: response.completed_at ?? null,
    runId: response.run_id ?? null,
    runStatus: response.run_status ?? null,
    history,
    historyPageInfo: {
      nextCursor: response.next_cursor ?? null,
      hasMore: Boolean(response.next_cursor)
    },
    messages,
    messagesPageInfo: {
      page: 1,
      pageSize: messages.length,
      total: messages.length,
      hasMore: Boolean(response.next_cursor)
    },
    progress: [],
    toolSummary: toolSummariesFromHistory(history),
    pendingToolCalls,
    status: statusFromLifecycle(
      conversationStatus,
      response.run_status,
      pendingToolCalls
    )
  };
}

function messagesFromHistory(history: AgentHistoryItem[]): AgentState["messages"] {
  return history
    .filter(
      (item) =>
        item.type === "message" &&
        (item.role === "user" || item.role === "assistant") &&
        Array.isArray(item.content)
    )
    .map((item) => ({
      id: item.id,
      role: item.role as "user" | "assistant",
      content: item.content ?? [],
      created_at: item.created_at
    }));
}

function compareHistoryItems(a: AgentHistoryItem, b: AgentHistoryItem): number {
  const timeDifference = Date.parse(a.created_at) - Date.parse(b.created_at);
  return timeDifference || a.id.localeCompare(b.id);
}

function toolSummariesFromHistory(
  history: AgentHistoryItem[]
): AgentToolSummary[] {
  return history.flatMap((item) => {
    if (
      !["tool", "action", "client_tool"].includes(item.type) ||
      typeof item.name !== "string" ||
      !item.name
    ) {
      return [];
    }
    return [
      {
        name: item.name,
        type: item.type,
        ...(typeof item.status === "string" ? { status: item.status } : {})
      }
    ];
  });
}

function pruneResolvedOutputs(
  resolvedOutputs: Map<string, Record<string, unknown>>,
  pendingToolCalls: AgentPendingToolCall[]
): void {
  const pendingIds = new Set(pendingToolCalls.map((call) => call.callId));
  for (const callId of resolvedOutputs.keys()) {
    if (!pendingIds.has(callId)) resolvedOutputs.delete(callId);
  }
}

function isConflict(error: AmarsiaSdkError): boolean {
  return error.status === 409;
}
