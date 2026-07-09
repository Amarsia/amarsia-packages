import { createAmarsiaClient } from "./client";
import type {
  AmarsiaClient,
  ConversationController,
  RunController,
  StreamController,
  TriggerController
} from "./client";
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
  CreateTriggerRequest,
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
  TriggerData,
  UsageMetadata
} from "./types";

export const amarsia = {
  init: createAmarsiaClient
};

export { createAmarsiaClient, AmarsiaSdkError };
export type {
  AmarsiaClient,
  ConversationController,
  RunController,
  StreamController,
  TriggerController
};
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
  CreateTriggerRequest,
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
  TriggerData,
  UsageMetadata
};
