import { createAmarsiaClient } from "./client";
import type { AmarsiaClient, ConversationController, RunController, StreamController } from "./client";
import { AmarsiaSdkError } from "./errors";
import type {
  AmarsiaSdkErrorData,
  AmarsiaStatus,
  ConversationData,
  ConversationMessage,
  ConversationSendRequest,
  ConversationState,
  InitConfig,
  ListConversationsRequest,
  LoadMessagesRequest,
  MessageContent,
  MessageFileContent,
  MessageRole,
  MessageTextContent,
  PaginatedConversationsResponse,
  PaginatedMessagesResponse,
  RunRequest,
  RunResponse,
  SendOptions,
  StatefulResult,
  StreamRequest,
  StreamResponse,
  UsageMetadata
} from "./types";

export const amarsia = {
  init: createAmarsiaClient
};

export { createAmarsiaClient, AmarsiaSdkError };
export type { AmarsiaClient, ConversationController, RunController, StreamController };
export type {
  AmarsiaSdkErrorData,
  AmarsiaStatus,
  ConversationData,
  ConversationMessage,
  ConversationSendRequest,
  ConversationState,
  InitConfig,
  ListConversationsRequest,
  LoadMessagesRequest,
  MessageContent,
  MessageFileContent,
  MessageRole,
  MessageTextContent,
  PaginatedConversationsResponse,
  PaginatedMessagesResponse,
  RunRequest,
  RunResponse,
  SendOptions,
  StatefulResult,
  StreamRequest,
  StreamResponse,
  UsageMetadata
};
