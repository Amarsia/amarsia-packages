import type { HttpClient } from "../core/http";
import { requestJson, resolveDeploymentId } from "../core/http";
import { setIfDefined } from "../core/object";
import type { RunRequest, RunResponse } from "../types";

export async function runRequest(client: HttpClient, input: RunRequest): Promise<{ data: RunResponse; raw: unknown }> {
  const deploymentId = resolveDeploymentId(client.deploymentId, input.deploymentId);

  const body: {
    content: RunRequest["content"];
    variables?: RunRequest["variables"];
    trigger_id?: string;
  } = {
    content: input.content,
    variables: input.variables
  };
  setIfDefined(body, "trigger_id", input.triggerId);

  return requestJson<RunResponse>(client, {
    method: "POST",
    path: `/v1/runner/${deploymentId}`,
    body
  });
}
