import { requestJson, requestStream, resolveDeploymentId } from "../core/http";
import { readTextStream } from "../core/stream";
import { createConfigError } from "../errors";
import type { HttpClient } from "../core/http";
import type {
  ConversationData,
  ConversationSendRequest,
  ListConversationsRequest,
  LoadMessagesRequest,
  PaginatedConversationsResponse,
  PaginatedMessagesResponse
} from "../types";

export async function createConversation(
  client: HttpClient,
  input: ConversationSendRequest
): Promise<{ data: ConversationData; raw: unknown }> {
  const deploymentId = resolveDeploymentId(client.deploymentId, input.deploymentId);

  return requestJson<ConversationData>(client, {
    method: "POST",
    path: `/v1/runner/${deploymentId}/conversation`,
    signal: input.signal,
    body: {
      content: input.content,
      variables: input.variables,
      meta: input.meta
    }
  });
}

type ContinueConversationOptions = {
  onChunk?: (chunk: string) => void;
};

export async function continueConversationStream(
  client: HttpClient,
  input: ConversationSendRequest,
  conversationId: string,
  options?: ContinueConversationOptions
): Promise<{ data: ConversationData; raw: unknown }> {
  const deploymentId = resolveDeploymentId(client.deploymentId, input.deploymentId);

  const response = await requestStream(client, {
    method: "POST",
    path: `/v1/runner/${deploymentId}/conversation/stream`,
    signal: input.signal,
    body: {
      conversation_id: conversationId,
      content: input.content,
      history_limit: input.historyLimit
    }
  });

  const content = await readTextStream(response, {
    onChunk: options?.onChunk
  });

  const data: ConversationData = {
    conversation_id: conversationId,
    content
  };

  return {
    data,
    raw: data
  };
}

export async function getConversationMessages(
  client: HttpClient,
  input: LoadMessagesRequest
): Promise<{ data: PaginatedMessagesResponse; raw: unknown }> {
  const conversationId = input.conversationId;
  if (!conversationId) {
    throw createConfigError("conversationId is required to fetch messages.");
  }

  return requestJson<PaginatedMessagesResponse>(client, {
    method: "GET",
    path: `/v1/runner/conversation/${conversationId}/messages`,
    query: {
      page: input.page ?? 1,
      page_size: input.pageSize ?? 20
    }
  });
}

export async function listConversations(
  client: HttpClient,
  input: ListConversationsRequest
): Promise<{ data: PaginatedConversationsResponse; raw: unknown }> {
  const query: Record<string, string | number | boolean | undefined> = {
    page: input.page ?? 1,
    page_size: input.pageSize ?? 20
  };

  if (input.meta) {
    for (const [key, value] of Object.entries(input.meta)) {
      query[key] = value;
    }
  }

  return requestJson<PaginatedConversationsResponse>(client, {
    method: "GET",
    path: "/v1/runner/conversations",
    query
  });
}

