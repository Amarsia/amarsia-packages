import { requestStream, resolveDeploymentId } from "../core/http";
import { setIfDefined } from "../core/object";
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

  const requestOptions: Parameters<typeof requestStream>[1] = {
    method: "POST",
    path: `/v1/runner/${deploymentId}/stream`,
    body: {
      content: input.content
    }
  };

  setIfDefined(requestOptions, "signal", input.signal);

  const body = requestOptions.body as { content: StreamRequest["content"]; variables?: StreamRequest["variables"] };
  setIfDefined(body, "variables", input.variables);

  const response = await requestStream(client, requestOptions);

  const streamOptions = options?.onChunk ? { onChunk: options.onChunk } : undefined;
  const content = await readTextStream(response, streamOptions);

  const data: StreamResponse = {
    content
  };

  return {
    data,
    raw: data
  };
}

