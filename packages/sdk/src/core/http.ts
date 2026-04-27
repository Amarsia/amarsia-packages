import { createConfigError, createValidationError, fromHttpError, wrapUnknownError } from "../errors";
import type { ApiErrorEnvelope, InitConfig } from "../types";

type HttpClientConfig = Required<Pick<InitConfig, "fetch">> & {
  apiKey?: string;
  baseUrl: string;
  deploymentId?: string;
  dangerouslyAllowBrowserApiKey?: boolean;
};

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

let hasWarnedBrowserApiKey = false;

export function createHttpClient(config: InitConfig): HttpClientConfig {
  const apiKey = config.apiKey?.trim();

  const rawFetch = config.fetch ?? (typeof globalThis !== "undefined" ? globalThis.fetch : undefined);
  if (typeof rawFetch !== "function") {
    throw createConfigError("No fetch implementation available. Provide `fetch` in amarsia.init(...) for this runtime.");
  }

  // Bind to globalThis when using the platform fetch so that `this` is not lost
  // when the function is stored as a property on the client (e.g. browsers
  // throw "Illegal invocation" if `window.fetch` is called with a different `this`).
  const fetchImpl: typeof globalThis.fetch = config.fetch
    ? config.fetch
    : (rawFetch as typeof globalThis.fetch).bind(globalThis);

  const baseUrl = normalizeBaseUrl(config.baseUrl ?? "https://api.amarsia.com");
  if (apiKey) {
    warnForBrowserApiKey(config.dangerouslyAllowBrowserApiKey);
  }

  const client: HttpClientConfig = {
    fetch: fetchImpl,
    baseUrl
  };

  if (apiKey) {
    client.apiKey = apiKey;
  }

  if (config.deploymentId !== undefined) {
    client.deploymentId = config.deploymentId;
  }

  if (config.dangerouslyAllowBrowserApiKey !== undefined) {
    client.dangerouslyAllowBrowserApiKey = config.dangerouslyAllowBrowserApiKey;
  }

  return client;
}

function warnForBrowserApiKey(dangerouslyAllowBrowserApiKey: boolean | undefined): void {
  const isBrowser = typeof window !== "undefined";
  if (!isBrowser || hasWarnedBrowserApiKey) {
    return;
  }

  if (dangerouslyAllowBrowserApiKey !== true) {
    hasWarnedBrowserApiKey = true;
     
    console.warn(
      "[Amarsia SDK] API keys in browser apps can be extracted and abused. Prefer a backend proxy or short-lived tokens. Set dangerouslyAllowBrowserApiKey=true to explicitly acknowledge this risk."
    );
  }
}

export function resolveDeploymentId(defaultDeploymentId: string | undefined, overrideDeploymentId: string | undefined): string {
  const trimmed = (overrideDeploymentId ?? defaultDeploymentId)?.trim();
  if (!trimmed) {
    throw createConfigError(
      "Missing deploymentId. Provide `deploymentId` in amarsia.init(...) or pass `deploymentId` in this request."
    );
  }
  return trimmed;
}

export async function requestJson<T>(client: HttpClientConfig, options: RequestOptions): Promise<{ data: T; raw: unknown }> {
  try {
    const response = await request(client, options);
    const text = await response.text();
    const json = safeJsonParse(text) as unknown;

    if (!response.ok) {
      throw fromHttpError(response.status, response.statusText, asApiErrorEnvelope(json), text);
    }

    if (!json || typeof json !== "object") {
      throw createValidationError("Expected JSON object response from API.", { body: text });
    }

    return {
      data: json as T,
      raw: json
    };
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

export async function requestStream(client: HttpClientConfig, options: RequestOptions): Promise<Response> {
  try {
    const response = await request(client, options);
    if (!response.ok) {
      const text = await response.text();
      const json = safeJsonParse(text) as unknown;
      throw fromHttpError(response.status, response.statusText, asApiErrorEnvelope(json), text);
    }

    if (!response.body) {
      throw createValidationError("Expected a readable stream body in response.");
    }

    return response;
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

function buildQuery(query: Record<string, string | number | boolean | undefined> | undefined): string {
  if (!query) {
    return "";
  }
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) {
      continue;
    }
    search.set(key, String(value));
  }
  const serialized = search.toString();
  return serialized ? `?${serialized}` : "";
}

function normalizeBaseUrl(value: string): string {
  const normalized = value.trim().replace(/\/+$/, "");
  if (!normalized) {
    throw createConfigError("`baseUrl` cannot be empty.");
  }
  return normalized;
}

function asApiErrorEnvelope(value: unknown): ApiErrorEnvelope | null {
  if (value && typeof value === "object") {
    return value as ApiErrorEnvelope;
  }
  return null;
}

function safeJsonParse(value: string): unknown {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

async function request(client: HttpClientConfig, options: RequestOptions): Promise<Response> {
  const query = buildQuery(options.query);
  const url = `${client.baseUrl}${options.path}${query}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...options.headers
  };

  if (client.apiKey) {
    headers["x-api-key"] = client.apiKey;
  }

  const init: RequestInit = {
    method: options.method ?? "POST",
    headers
  };

  if (options.signal !== undefined) {
    init.signal = options.signal;
  }

  if (options.body !== undefined) {
    init.body = JSON.stringify(options.body);
  }

  return client.fetch(url, init);
}

export type HttpClient = ReturnType<typeof createHttpClient>;

