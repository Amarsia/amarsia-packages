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
  const payload = envelope?.error;
  const message = payload?.message ?? fallbackBody ?? `Request failed with status ${status} ${statusText}`.trim();

  const data: AmarsiaSdkErrorData = {
    name: "AmarsiaHttpError",
    message,
    status
  };

  if (payload?.type !== undefined) data.type = payload.type;
  if (payload?.code !== undefined) data.code = payload.code;
  if (payload?.param !== undefined) data.param = payload.param;

  const details = envelope ?? fallbackBody;
  if (details !== undefined) data.details = details;

  return new AmarsiaSdkError(data);
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

