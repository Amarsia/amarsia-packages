import type { HttpClient } from "../core/http";
import { requestJson, resolveDeploymentId } from "../core/http";
import { setIfDefined } from "../core/object";
import type { CreateTriggerRequest, TriggerData } from "../types";

export async function createTrigger(
  client: HttpClient,
  input: CreateTriggerRequest
): Promise<{ data: TriggerData; raw: unknown }> {
  const deploymentId = resolveDeploymentId(client.deploymentId, input.deploymentId);

  const requestOptions: Parameters<typeof requestJson<TriggerData>>[1] = {
    method: "POST",
    path: `/v1/runner/${deploymentId}/trigger`,
    body: {
      content: input.content
    }
  };

  const body = requestOptions.body as {
    content: CreateTriggerRequest["content"];
    variables?: CreateTriggerRequest["variables"];
    ui_surface?: string;
    ttl_hours?: number | null;
  };

  setIfDefined(body, "variables", input.variables);
  setIfDefined(body, "ui_surface", input.uiSurface);
  if (input.ttlHours !== undefined) {
    body.ttl_hours = input.ttlHours;
  }

  return requestJson<TriggerData>(client, requestOptions);
}

export async function getTrigger(
  client: HttpClient,
  input: { deploymentId?: string; triggerId: string }
): Promise<{ data: TriggerData; raw: unknown }> {
  const deploymentId = resolveDeploymentId(client.deploymentId, input.deploymentId);

  return requestJson<TriggerData>(client, {
    method: "GET",
    path: `/v1/runner/${deploymentId}/trigger/${input.triggerId}`
  });
}
