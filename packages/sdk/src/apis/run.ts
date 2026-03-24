import type { HttpClient } from "../core/http";
import { requestJson, resolveDeploymentId } from "../core/http";
import type { RunRequest, RunResponse } from "../types";

export async function runRequest(client: HttpClient, input: RunRequest): Promise<{ data: RunResponse; raw: unknown }> {
  const deploymentId = resolveDeploymentId(client.deploymentId, input.deploymentId);

  return requestJson<RunResponse>(client, {
    method: "POST",
    path: `/v1/runner/${deploymentId}`,
    body: {
      content: input.content,
      variables: input.variables
    }
  });
}

