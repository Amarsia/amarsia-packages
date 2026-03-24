import { createValidationError, wrapUnknownError } from "../errors";

type ReadStreamOptions = {
  onChunk?: (chunk: string) => void;
};

export async function readTextStream(response: Response, options?: ReadStreamOptions): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw createValidationError("Response body is not readable.");
  }

  const decoder = new TextDecoder();
  let fullText = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      const chunk = decoder.decode(value, { stream: true });
      if (!chunk) {
        continue;
      }
      fullText += chunk;
      options?.onChunk?.(chunk);
    }

    return fullText;
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

