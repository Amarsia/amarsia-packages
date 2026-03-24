import { requestStream, resolveDeploymentId } from "../core/http";
import { readTextStream } from "../core/stream";
import type { HttpClient } from "../core/http";
import type { StreamRequest, StreamResponse } from "../types";

type StreamRequestOptions = {
  onChunk?: (chunk: string) => void;
};

export async function streamRequest(
  client: HttpClient,
  input: StreamRequest,
  options?: StreamRequestOptions
): Promise<{ data: StreamResponse; raw: unknown }> {
  const deploymentId = resolveDeploymentId(client.deploymentId, input.deploymentId);

  const response = await requestStream(client, {
    method: "POST",
    path: `/v1/runner/${deploymentId}/stream`,
    signal: input.signal,
    body: {
      content: input.content,
      variables: input.variables
    }
  });

  const content = await readTextStream(response, {
    onChunk: options?.onChunk
  });

  const data: StreamResponse = {
    content
  };

  return {
    data,
    raw: data
  };
}

