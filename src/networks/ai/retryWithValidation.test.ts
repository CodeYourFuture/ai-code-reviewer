import type { ChatGenerationParams, Message } from "@openrouter/sdk/models";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AiResponseSchema, type AiResponse } from "../../types/aiResponse.js";
import { aiCall, validateAiResponse } from "./ai_api_request.js";
import { askOpenRouterWithValidation } from "./retryWithValidation.js";

// Mocked with a factory so the real module is never imported: it builds an
// OpenRouter client from validated env vars at import time, which would make
// these tests depend on the local .env.
vi.mock("./ai_api_request.js", () => ({
  aiCall: vi.fn(),
  validateAiResponse: vi.fn(),
}));

const mockedAiCall = vi.mocked(aiCall);
const mockedValidateAiResponse = vi.mocked(validateAiResponse);

const messages: Message[] = [{ role: "user", content: "1: const a = 1;" }];
const requestParams: Partial<ChatGenerationParams> = {
  temperature: 0,
  model: "test-model",
};

const mockFeedback: AiResponse = {
  feedback_points: [
    {
      file_name: "file.ts",
      topic: "naming",
      point: "description",
      line_numbers: ["10"],
      severity: 1,
    },
  ],
};

// A real ZodError, because askOpenRouterWithValidation only retries on those.
function schemaErrorFor(value: unknown): z.ZodError {
  const result = AiResponseSchema.safeParse(value);
  if (result.success) {
    throw new Error("test setup: expected the schema to reject this value");
  }
  return result.error;
}

const schemaError = schemaErrorFor({ feedback_points: "not an array" });

describe("askOpenRouterWithValidation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // The function logs on every retry; keep the test output readable.
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("returns the validated response without retrying when it is valid", async () => {
    mockedAiCall.mockResolvedValue("raw-json");
    mockedValidateAiResponse.mockReturnValue(mockFeedback);

    const result = await askOpenRouterWithValidation(messages, requestParams);

    expect(result).toEqual(mockFeedback);
    expect(mockedAiCall).toHaveBeenCalledTimes(1);
    expect(mockedAiCall).toHaveBeenCalledWith(messages, requestParams);
    expect(mockedValidateAiResponse).toHaveBeenCalledTimes(1);
    expect(mockedValidateAiResponse).toHaveBeenCalledWith("raw-json");
  });

  it("retries and succeeds when the first response fails schema validation", async () => {
    mockedAiCall
      .mockResolvedValueOnce("invalid-json")
      .mockResolvedValueOnce("raw-json");
    mockedValidateAiResponse
      .mockImplementationOnce(() => {
        throw schemaError;
      })
      .mockReturnValueOnce(mockFeedback);

    const result = await askOpenRouterWithValidation(messages, requestParams);

    expect(result).toEqual(mockFeedback);
    expect(mockedAiCall).toHaveBeenCalledTimes(2);
    expect(mockedAiCall).toHaveBeenNthCalledWith(2, messages, requestParams);
    expect(mockedValidateAiResponse).toHaveBeenCalledTimes(2);
  });

  it("rethrows the validation error once the retry budget is exhausted", async () => {
    mockedAiCall.mockResolvedValue("invalid-json");
    mockedValidateAiResponse.mockImplementation(() => {
      throw schemaError;
    });

    await expect(
      askOpenRouterWithValidation(messages, requestParams),
    ).rejects.toBe(schemaError);

    // Default is one retry, so the initial attempt plus one more.
    expect(mockedAiCall).toHaveBeenCalledTimes(2);
  });

  it("makes retries + 1 attempts when a retry count is given", async () => {
    mockedAiCall.mockResolvedValue("invalid-json");
    mockedValidateAiResponse.mockImplementation(() => {
      throw schemaError;
    });

    await expect(
      askOpenRouterWithValidation(messages, requestParams, 3),
    ).rejects.toBe(schemaError);

    expect(mockedAiCall).toHaveBeenCalledTimes(4);
  });

  it("does not retry when validation throws something other than a ZodError", async () => {
    // e.g. JSON.parse failing inside validateAiResponse on non-JSON output.
    const parseError = new SyntaxError("Unexpected token < in JSON");
    mockedAiCall.mockResolvedValue("<html>oops</html>");
    mockedValidateAiResponse.mockImplementation(() => {
      throw parseError;
    });

    await expect(
      askOpenRouterWithValidation(messages, requestParams),
    ).rejects.toBe(parseError);

    expect(mockedAiCall).toHaveBeenCalledTimes(1);
  });

  it("does not retry when the request itself fails", async () => {
    const requestError = new Error("No content returned from OpenRouter");
    mockedAiCall.mockRejectedValue(requestError);

    await expect(
      askOpenRouterWithValidation(messages, requestParams),
    ).rejects.toBe(requestError);

    expect(mockedAiCall).toHaveBeenCalledTimes(1);
    expect(mockedValidateAiResponse).not.toHaveBeenCalled();
  });
});
