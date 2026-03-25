export type AmarsiaStatus = "idle" | "loading" | "streaming" | "success" | "error";

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
  id: string;
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
  error?: {
    type?: string;
    message?: string;
    param?: string | null;
    code?: string | null;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type RunRequest = {
  deploymentId?: string;
  content: MessageContent[];
  variables?: Record<string, unknown>;
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
};

export type ConversationRunOptions = {
  content: MessageContent[];
  historyLimit?: number;
  signal?: AbortSignal;
  variables?: Record<string, unknown>;
  meta?: Record<string, string | number | boolean>;
};

export type ConversationStreamOptions = ConversationRunOptions;

export type ConversationData = {
  conversation_id: string;
  content: string | Record<string, unknown>;
  name?: string;
  model?: string;
  input_tokens?: number;
  output_tokens?: number;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
};

export type ListConversationsRequest = {
  page?: number;
  pageSize?: number;
  meta?: Record<string, string>;
};

export type LoadMessagesRequest = {
  page?: number;
  pageSize?: number;
  conversationId?: string;
};

export type PaginatedConversationsResponse = {
  conversations: Array<Record<string, unknown>>;
  page: number;
  page_size: number;
  total: number;
  has_more: boolean;
  [key: string]: unknown;
};

export type PaginatedMessagesResponse = {
  messages: ConversationMessage[];
  page: number;
  page_size: number;
  total: number;
  has_more: boolean;
  [key: string]: unknown;
};

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
  conversations: Array<Record<string, unknown>>;
};

export type InitConfig = {
  apiKey: string;
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

