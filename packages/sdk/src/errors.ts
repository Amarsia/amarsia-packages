import type { AmarsiaSdkErrorData, ApiErrorEnvelope } from "./types";

export class AmarsiaSdkError extends Error {
  readonly status: number | undefined;
  readonly type: string | undefined;
  readonly code: string | null | undefined;
  readonly param: string | null | undefined;
  readonly details: unknown;

  constructor(data: AmarsiaSdkErrorData) {
    super(data.message);
    this.name = data.name;
    this.status = data.status;
    this.type = data.type;
    this.code = data.code;
    this.param = data.param;
    this.details = data.details;
  }

  toJSON(): AmarsiaSdkErrorData {
    const json: AmarsiaSdkErrorData = {
      name: this.name,
      message: this.message
    };

    if (this.status !== undefined) json.status = this.status;
    if (this.type !== undefined) json.type = this.type;
    if (this.code !== undefined) json.code = this.code;
    if (this.param !== undefined) json.param = this.param;
    if (this.details !== undefined) json.details = this.details;

    return json;
  }
}

export function toErrorData(error: unknown): AmarsiaSdkErrorData {
  if (error instanceof AmarsiaSdkError) {
    return error.toJSON();
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message
    };
  }

  return {
    name: "AmarsiaUnknownError",
    message: "An unknown error occurred.",
    details: error
  };
}

export function createConfigError(message: string): AmarsiaSdkError {
  return new AmarsiaSdkError({
    name: "AmarsiaConfigurationError",
    message
  });
}

export function createValidationError(message: string, details?: unknown): AmarsiaSdkError {
  const data: AmarsiaSdkErrorData = {
    name: "AmarsiaValidationError",
    message
  };
  if (details !== undefined) data.details = details;
  return new AmarsiaSdkError(data);
}

export function createAbortError(message = "Request was aborted."): AmarsiaSdkError {
  return new AmarsiaSdkError({
    name: "AmarsiaAbortError",
    message
  });
}

export function fromHttpError(
  status: number,
  statusText: string,
  envelope: ApiErrorEnvelope | null,
  fallbackBody?: string
): AmarsiaSdkError {
  const parsed = parseErrorEnvelope(envelope);
  const message =
    parsed.message ??
    (typeof fallbackBody === "string" && fallbackBody.trim() !== "" && !looksLikeJsonObject(fallbackBody)
      ? fallbackBody
      : `Request failed with status ${status} ${statusText}`.trim());

  const data: AmarsiaSdkErrorData = {
    name: "AmarsiaHttpError",
    message,
    status,
    code: parsed.code ?? statusToCode(status)
  };

  if (parsed.type !== undefined) data.type = parsed.type;
  if (parsed.param !== undefined) data.param = parsed.param;

  const details = envelope ?? fallbackBody;
  if (details !== undefined) data.details = details;

  return new AmarsiaSdkError(data);
}

type ParsedEnvelope = {
  message?: string;
  code?: string | null;
  type?: string;
  param?: string | null;
};

function parseErrorEnvelope(envelope: ApiErrorEnvelope | null): ParsedEnvelope {
  if (!envelope) {
    return {};
  }

  const openai = envelope.error;
  if (openai && typeof openai === "object") {
    const parsed: ParsedEnvelope = {};
    if (typeof openai.message === "string") parsed.message = openai.message;
    if (openai.code !== undefined) parsed.code = openai.code;
    if (typeof openai.type === "string") parsed.type = openai.type;
    if (openai.param !== undefined) parsed.param = openai.param;
    if (parsed.message !== undefined) return parsed;
  }

  const detail = envelope.detail;
  if (typeof detail === "string" && detail.trim() !== "") {
    return { message: detail };
  }

  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0];
    const field = Array.isArray(first?.loc) ? first.loc.filter((p) => typeof p === "string").join(".") : "";
    const msg = typeof first?.msg === "string" ? first.msg : undefined;
    const message = field ? (msg ? `${field}: ${msg}` : field) : msg;
    const parsed: ParsedEnvelope = {};
    if (message) parsed.message = message;
    if (typeof first?.type === "string") parsed.type = first.type;
    if (field) parsed.param = field;
    return parsed;
  }

  if (detail && typeof detail === "object") {
    const parsed: ParsedEnvelope = {};
    const msg = (detail as Record<string, unknown>).message;
    const code = (detail as Record<string, unknown>).code;
    const type = (detail as Record<string, unknown>).type;
    if (typeof msg === "string") parsed.message = msg;
    if (typeof code === "string" || code === null) parsed.code = code as string | null;
    if (typeof type === "string") parsed.type = type;
    return parsed;
  }

  return {};
}

function statusToCode(status: number): string {
  switch (status) {
    case 400:
      return "bad_request";
    case 401:
      return "unauthorized";
    case 402:
      return "payment_required";
    case 403:
      return "forbidden";
    case 404:
      return "not_found";
    case 408:
      return "request_timeout";
    case 409:
      return "conflict";
    case 413:
      return "payload_too_large";
    case 422:
      return "unprocessable_entity";
    case 429:
      return "rate_limited";
    case 500:
      return "internal_server_error";
    case 502:
      return "bad_gateway";
    case 503:
      return "service_unavailable";
    case 504:
      return "gateway_timeout";
    default:
      if (status >= 500) return "server_error";
      if (status >= 400) return "http_error";
      return "http_error";
  }
}

function looksLikeJsonObject(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.startsWith("{") || trimmed.startsWith("[");
}

export function wrapUnknownError(error: unknown): AmarsiaSdkError {
  if (error instanceof AmarsiaSdkError) {
    return error;
  }

  if (error instanceof DOMException && error.name === "AbortError") {
    return createAbortError();
  }

  if (error instanceof Error) {
    return new AmarsiaSdkError({
      name: "AmarsiaNetworkError",
      message: error.message
    });
  }

  return new AmarsiaSdkError({
    name: "AmarsiaUnknownError",
    message: "An unknown error occurred.",
    details: error
  });
}

