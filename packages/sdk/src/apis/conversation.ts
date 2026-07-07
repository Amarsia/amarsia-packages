import { requestJson, requestStream, resolveDeploymentId } from "../core/http";
import { setIfDefined } from "../core/object";
import { readTextStream } from "../core/stream";
import { createConfigError } from "../errors";
import type { HttpClient } from "../core/http";
import type {
  ConversationData,
  ConversationListResponse,
  ConversationMessagesResponse,
  ConversationSendRequest,
  ClientToolResult,
  ListConversationsRequest,
  LoadMessagesRequest
} from "../types";

export async function createConversation(
  client: HttpClient,
  input: ConversationSendRequest
): Promise<{ data: ConversationData; raw: unknown }> {
  const deploymentId = resolveDeploymentId(client.deploymentId, input.deploymentId);

  const requestOptions: Parameters<typeof requestJson<ConversationData>>[1] = {
    method: "POST",
    path: `/v1/runner/${deploymentId}/conversation`,
    body: {
      content: input.content
    }
  };

  setIfDefined(requestOptions, "signal", input.signal);

  const body = requestOptions.body as {
    content: ConversationSendRequest["content"];
    variables?: ConversationSendRequest["variables"];
    meta?: ConversationSendRequest["meta"];
  };

  setIfDefined(body, "variables", input.variables);
  setIfDefined(body, "meta", input.meta);

  return requestJson<ConversationData>(client, requestOptions);
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

  const requestOptions: Parameters<typeof requestStream>[1] = {
    method: "POST",
    path: `/v1/runner/${deploymentId}/conversation/stream`,
    body: {
      conversation_id: conversationId,
      content: input.content
    }
  };

  setIfDefined(requestOptions, "signal", input.signal);

  const streamBody = requestOptions.body as {
    conversation_id: string;
    content: ConversationSendRequest["content"];
    history_limit?: number;
  };
  setIfDefined(streamBody, "history_limit", input.historyLimit);

  const response = await requestStream(client, requestOptions);

  const streamOptions = options?.onChunk ? { onChunk: options.onChunk } : undefined;
  const content = await readTextStream(response, streamOptions);

  const data: ConversationData = {
    conversation_id: conversationId,
    content
  };

  return {
    data,
    raw: data
  };
}

export async function continueConversation(
  client: HttpClient,
  input: ConversationSendRequest,
  conversationId: string
): Promise<{ data: ConversationData; raw: unknown }> {
  const deploymentId = resolveDeploymentId(client.deploymentId, input.deploymentId);

  const requestOptions: Parameters<typeof requestJson<ConversationData>>[1] = {
    method: "POST",
    path: `/v1/runner/${deploymentId}/conversation`,
    body: {
      conversation_id: conversationId,
      content: input.content
    }
  };

  setIfDefined(requestOptions, "signal", input.signal);

  const body = requestOptions.body as {
    conversation_id: string;
    content: ConversationSendRequest["content"];
    history_limit?: number;
  };
  setIfDefined(body, "history_limit", input.historyLimit);

  return requestJson<ConversationData>(client, requestOptions);
}

export async function runConversationV2(
  client: HttpClient,
  input: ConversationSendRequest,
  conversationId?: string
): Promise<{ data: ConversationData; raw: unknown }> {
  const deploymentId = resolveDeploymentId(client.deploymentId, input.deploymentId);
  const requestOptions: Parameters<typeof requestJson<ConversationData>>[1] = {
    method: "POST",
    path: `/v2/runner/${deploymentId}/conversation`,
    body: {
      content: input.content
    }
  };

  setIfDefined(requestOptions, "signal", input.signal);

  const body = requestOptions.body as {
    content: ConversationSendRequest["content"];
    conversation_id?: string;
    variables?: ConversationSendRequest["variables"];
    meta?: ConversationSendRequest["meta"];
    history_limit?: number;
    client_capabilities?: string[];
  };
  setIfDefined(body, "conversation_id", conversationId);
  setIfDefined(body, "variables", input.variables);
  setIfDefined(body, "meta", input.meta);
  setIfDefined(body, "history_limit", input.historyLimit);
  setIfDefined(body, "client_capabilities", input.clientCapabilities);

  return requestJson<ConversationData>(client, requestOptions);
}

export async function resumeConversationV2(
  client: HttpClient,
  input: ConversationSendRequest,
  conversationId: string,
  runId: string,
  toolResults: ClientToolResult[]
): Promise<{ data: ConversationData; raw: unknown }> {
  const deploymentId = resolveDeploymentId(client.deploymentId, input.deploymentId);
  const requestOptions: Parameters<typeof requestJson<ConversationData>>[1] = {
    method: "POST",
    path: `/v2/runner/${deploymentId}/conversation`,
    body: {
      conversation_id: conversationId,
      run_id: runId,
      tool_results: toolResults
    }
  };

  setIfDefined(requestOptions, "signal", input.signal);

  const body = requestOptions.body as {
    conversation_id: string;
    run_id: string;
    tool_results: ClientToolResult[];
    history_limit?: number;
    client_capabilities?: string[];
  };
  setIfDefined(body, "history_limit", input.historyLimit);
  setIfDefined(body, "client_capabilities", input.clientCapabilities);

  return requestJson<ConversationData>(client, requestOptions);
}

export async function getConversationMessages(
  client: HttpClient,
  input: LoadMessagesRequest
): Promise<{ data: ConversationMessagesResponse; raw: unknown }> {
  const conversationId = input.conversationId;
  if (!conversationId) {
    throw createConfigError("conversationId is required to fetch messages.");
  }

  return requestJson<ConversationMessagesResponse>(client, {
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
): Promise<{ data: ConversationListResponse; raw: unknown }> {
  const deploymentId = resolveDeploymentId(client.deploymentId, input.deploymentId);
  const query: Record<string, string | number | boolean | undefined> = {
    page: input.page ?? 1,
    page_size: input.pageSize ?? 20
  };

  if (input.meta) {
    for (const [key, value] of Object.entries(input.meta)) {
      query[key] = value;
    }
  }

  return requestJson<ConversationListResponse>(client, {
    method: "GET",
    path: `/v1/runner/${deploymentId}/conversations`,
    query
  });
}

