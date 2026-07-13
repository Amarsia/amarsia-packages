export type AmarsiaStatus =
  | "idle"
  | "loading"
  | "streaming"
  | "awaiting_input"
  | "success"
  | "error";

export type MessageRole = "user" | "assistant" | "system" | "tool";

export type MessageTextContent = {
  type: "text";
  text: string;
};

export type MessageFileContent = {
  type: "image" | "video" | "audio" | "url";
  mime_type: string;
  file_uri: string;
};

export type MessageContent = MessageTextContent | MessageFileContent;

export type ConversationMessage = {
  id: string | number;
  role: MessageRole;
  content: MessageContent[];
  created_at: string;
  metadata?: Record<string, unknown>;
};

export type UsageMetadata = {
  input_tokens?: number;
  output_tokens?: number;
  model?: string;
  request_id?: string;
  [key: string]: unknown;
};

export type ApiErrorEnvelope = {
  /**
   * OpenAI-style error envelope.
   */
  error?: {
    type?: string;
    message?: string;
    param?: string | null;
    code?: string | null;
    [key: string]: unknown;
  };
  /**
   * FastAPI-style error envelope. Plain HTTPException serializes to
   * `{ detail: "string" }`; validation errors serialize to
   * `{ detail: [{ msg, loc, type, ... }, ...] }`.
   */
  detail?:
    | string
    | {
        message?: string;
        code?: string | null;
        type?: string;
        [key: string]: unknown;
      }
    | Array<{
        msg?: string;
        type?: string;
        loc?: Array<string | number>;
        [key: string]: unknown;
      }>;
  [key: string]: unknown;
};

export type RunRequest = {
  deploymentId?: string;
  content: MessageContent[];
  variables?: Record<string, unknown>;
  triggerId?: string;
};

export type RunResponse = {
  content: string | Record<string, unknown>;
  model?: string;
  input_tokens?: number;
  output_tokens?: number;
  [key: string]: unknown;
};

export type StreamRequest = {
  deploymentId?: string;
  content: MessageContent[];
  variables?: Record<string, unknown>;
  triggerId?: string;
  signal?: AbortSignal;
};

export type StreamResponse = {
  content: string;
  model?: string;
  input_tokens?: number;
  output_tokens?: number;
  [key: string]: unknown;
};

export type ConversationSendRequest = {
  deploymentId?: string;
  content: MessageContent[];
  variables?: Record<string, unknown>;
  meta?: Record<string, string | number | boolean>;
  historyLimit?: number;
  signal?: AbortSignal;
  clientCapabilities?: ClientCapability[];
  triggerId?: string;
};

export type ClientCapability =
  | string
  | {
      name: string;
      input_schema?: Record<string, unknown>;
    };

export type ClientToolCall = {
  call_id: string;
  name: string;
  arguments: Record<string, unknown>;
};

export type ClientToolResult = {
  call_id: string;
  output: Record<string, unknown>;
};

export type ClientToolHandler = (
  arguments_: Record<string, unknown>,
  call: ClientToolCall
) => Promise<Record<string, unknown>> | Record<string, unknown>;

export type AgentClientToolContext = {
  callId: string;
  name: string;
  conversationId: string;
  signal: AbortSignal;
};

export type AgentClientToolHandler = ((
  arguments_: Record<string, unknown>,
  context: AgentClientToolContext
) => Promise<Record<string, unknown>> | Record<string, unknown>) & {
  inputSchema?: Record<string, unknown>;
};

export type AgentClientTools = Record<string, AgentClientToolHandler>;

export type AgentPendingToolCall = {
  callId: string;
  name: string;
  arguments: Record<string, unknown>;
};

export type AgentProgress = {
  type?: string;
  call_id?: string;
  name?: string;
  summary?: string;
  [key: string]: unknown;
};

export type AgentToolSummary = {
  name?: string;
  status?: string;
  [key: string]: unknown;
};

export type AgentHistoryItem = {
  id: string;
  type: "message" | "tool" | "action" | "client_tool" | string;
  created_at: string;
  role?: "user" | "assistant";
  content?: MessageContent[];
  name?: string;
  status?: string;
  summary?: string;
  call_id?: string;
  arguments?: Record<string, unknown>;
};

export type AgentHistoryResponse = {
  conversation_id: string;
  conversation_status: string;
  completed_at?: string | null;
  run_id?: string | null;
  run_status?: AgentRunStatus | null;
  pending_client_actions?: ClientToolCall[];
  items: AgentHistoryItem[];
  next_cursor?: string | null;
};

export type AgentHistoryPageInfo = {
  nextCursor: string | null;
  hasMore: boolean;
};

export type AgentStatus =
  | "idle"
  | "loading"
  | "running"
  | "awaiting_input"
  | "success"
  | "error"
  | "closed";

export type AgentRunStatus =
  | "running"
  | "waiting_for_client_action"
  | "completed"
  | "interrupted"
  | "failed"
  | "expired";

export type AgentMessagesPageInfo = {
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
};

export type AgentState = {
  conversationId: string | null;
  conversationStatus: string | null;
  completedAt: string | null;
  runId: string | null;
  runStatus: AgentRunStatus | null;
  history: AgentHistoryItem[];
  historyPageInfo: AgentHistoryPageInfo | null;
  messages: ConversationMessage[];
  messagesPageInfo: AgentMessagesPageInfo | null;
  progress: AgentProgress[];
  toolSummary: AgentToolSummary[];
  pendingToolCalls: AgentPendingToolCall[];
  status: AgentStatus;
  error: AmarsiaSdkErrorData | null;
};

export type AgentStartOptions = {
  deploymentId?: string;
  content?: MessageContent[];
  conversationId?: string;
  triggerId?: string;
  meta?: Record<string, string | number | boolean>;
  variables?: Record<string, unknown>;
  historyLimit?: number;
  clientTools?: AgentClientTools;
  pollIntervalMs?: number;
  historyPageSize?: number;
  /** @deprecated Use historyPageSize. */
  messagePageSize?: number;
  signal?: AbortSignal;
};

export type AgentOpenOptions = {
  deploymentId?: string;
  clientTools?: AgentClientTools;
  pollIntervalMs?: number;
  historyPageSize?: number;
  /** @deprecated Use historyPageSize. */
  messagePageSize?: number;
  signal?: AbortSignal;
};

export type AgentGetOptions = {
  deploymentId?: string;
  pageSize?: number;
  signal?: AbortSignal;
};

export type AgentLoadMoreHistoryOptions = {
  pageSize?: number;
  signal?: AbortSignal;
};

/** @deprecated Use AgentLoadMoreHistoryOptions. */
export type AgentLoadMoreMessagesOptions = AgentLoadMoreHistoryOptions;

export type AgentContinueOptions = {
  content?: MessageContent[];
  historyLimit?: number;
};

export type ConversationRunOptions = {
  content: MessageContent[];
  historyLimit?: number;
  signal?: AbortSignal;
  variables?: Record<string, unknown>;
  meta?: Record<string, string | number | boolean>;
  clientTools?: Record<string, ClientToolHandler>;
  triggerId?: string;
};

export type CreateTriggerRequest = {
  deploymentId?: string;
  content: MessageContent[];
  variables?: Record<string, unknown>;
  uiSurface?: string;
  /** Hours until expiry. Pass `null` for no expiry. Default on server is 24. */
  ttlHours?: number | null;
};

export type TriggerData = {
  id: string;
  deployment_id: string;
  workflow_id: number;
  ui_surface?: string | null;
  content: MessageContent[];
  variables?: Record<string, unknown> | null;
  conversation_id?: string | null;
  workflow_log_id?: number | null;
  created_at: string;
  expires_at?: string | null;
  expired: boolean;
};

export type ConversationStreamOptions = ConversationRunOptions;

export type ConversationData = {
  conversation_id: string;
  run_status?: AgentRunStatus;
  conversation_status?: string;
  completed_at?: string | null;
  content?: string | Record<string, unknown>;
  run_id?: string;
  client_tool_calls?: ClientToolCall[];
  progress?: AgentProgress[];
  name?: string;
  model?: string;
  input_tokens?: number;
  output_tokens?: number;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
};

export interface ChatConversation {
  id: string;
  status?: string;
  completed_at?: string | null;
  name?: string | null;
  created_at?: string;
  updated_at?: string;
  message_count?: number;
  meta?: Record<string, unknown>;
  run_id?: string | null;
  run_status?: AgentRunStatus | null;
  pending_client_actions?: ClientToolCall[];
  tool_summary?: AgentToolSummary[];
  progress?: AgentProgress[];
}

export type ListConversationsRequest = {
  deploymentId?: string;
  page?: number;
  pageSize?: number;
  meta?: Record<string, string>;
};

export type LoadMessagesRequest = {
  page?: number;
  pageSize?: number;
  conversationId?: string;
  signal?: AbortSignal;
};

export type ConversationLoadMessagesOptions = {
  conversationId?: string;
  page?: number;
  pageSize?: number;
  append?: boolean;
};

export interface ConversationListResponse {
  items: ChatConversation[];
  page: number;
  page_size: number;
  total: number;
  has_more: boolean;
}

export interface ConversationMessagesResponse {
  items: ConversationMessage[];
  page: number;
  page_size: number;
  total: number;
  has_more: boolean;
  conversation_status?: string;
  completed_at?: string | null;
  run_id?: string | null;
  run_status?: AgentRunStatus | null;
  pending_client_actions?: ClientToolCall[];
  tool_summary?: AgentToolSummary[];
  progress?: AgentProgress[];
}

export type StatefulResult<TData> = {
  status: AmarsiaStatus;
  data: TData | null;
  live: string;
  error: AmarsiaSdkErrorData | null;
  meta: UsageMetadata | null;
  raw: unknown;
};

export type ConversationState = StatefulResult<ConversationData> & {
  id: string | null;
  deploymentId: string | null;
  messages: ConversationMessage[];
  messagesPageInfo: {
    page: number;
    page_size: number;
    total: number;
    has_more: boolean;
  } | null;
  conversationsPageInfo: {
    page: number;
    page_size: number;
    total: number;
    has_more: boolean;
  } | null;
  conversations: ChatConversation[];
  pendingToolCalls: ClientToolCall[];
};

export type InitConfig = {
  /**
   * Optional. Required only when the target workflow has authentication
   * enabled server-side. Public workflows (authentication turned off) can
   * be called without an API key and are authorized by their allowlist.
   */
  apiKey?: string;
  deploymentId?: string;
  baseUrl?: string;
  dangerouslyAllowBrowserApiKey?: boolean;
  fetch?: typeof globalThis.fetch;
};

export type AmarsiaSdkErrorData = {
  name: string;
  message: string;
  status?: number;
  type?: string;
  code?: string | null;
  param?: string | null;
  details?: unknown;
};

export type Subscription<TState> = (state: Readonly<TState>) => void;

