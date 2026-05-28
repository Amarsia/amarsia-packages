import { createAmarsiaClient } from "./client";
import type { AmarsiaClient, ConversationController, RunController, StreamController } from "./client";
import { AmarsiaSdkError } from "./errors";
import type {
  AmarsiaSdkErrorData,
  AmarsiaStatus,
  ChatConversation,
  ConversationData,
  ConversationListResponse,
  ConversationMessagesResponse,
  ConversationMessage,
  ConversationRunOptions,
  ConversationSendRequest,
  ConversationStreamOptions,
  ConversationState,
  InitConfig,
  ListConversationsRequest,
  LoadMessagesRequest,
  MessageContent,
  MessageFileContent,
  MessageRole,
  MessageTextContent,
  RunRequest,
  RunResponse,
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
  ChatConversation,
  ConversationData,
  ConversationListResponse,
  ConversationMessagesResponse,
  ConversationMessage,
  ConversationRunOptions,
  ConversationSendRequest,
  ConversationStreamOptions,
  ConversationState,
  InitConfig,
  ListConversationsRequest,
  LoadMessagesRequest,
  MessageContent,
  MessageFileContent,
  MessageRole,
  MessageTextContent,
  RunRequest,
  RunResponse,
  StatefulResult,
  StreamRequest,
  StreamResponse,
  UsageMetadata
};
