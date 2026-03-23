import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AiResponse } from "../../types/aiResponse.js";
import * as aiModule from "../ai_api_request.js";
import { askOpenRouterWithValidation } from "./retryWithValidation.js";

const mockFeedback: AiResponse = {
  feedback_type: "code quality",
  feedback_points: [
    {
      file_name: "file.ts",
      topics: [],
      summary: "summary",
      point: "description",
      line_numbers: "10",
      severity: 1,
    },
  ],
};

describe("askOpenRouterWithValidation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("calls aiCall only once when response is valid", async () => {
    const prompt = "test prompt";

    const aiSpy = vi.spyOn(aiModule, "aiCall").mockResolvedValue("mock-json");

    const validateSpy = vi
      .spyOn(aiModule, "validateAiResponse")
      .mockReturnValue(mockFeedback);

    const result = await askOpenRouterWithValidation(prompt, "code quality");

    expect(result).toEqual(mockFeedback);
    expect(aiSpy).toHaveBeenCalledTimes(1);
    expect(validateSpy).toHaveBeenCalledTimes(1);
  });

  it("retries when validation fails once", async () => {
    const prompt = "test prompt";

    const aiSpy = vi.spyOn(aiModule, "aiCall").mockResolvedValue("mock-json");

    const validateSpy = vi
      .spyOn(aiModule, "validateAiResponse")
      .mockImplementationOnce(() => {
        throw new Error("Invalid schema");
      })
      .mockReturnValueOnce(mockFeedback);

    const result = await askOpenRouterWithValidation(prompt, "code quality");

    expect(result).toEqual(mockFeedback);
    expect(aiSpy).toHaveBeenCalledTimes(2);
    expect(validateSpy).toHaveBeenCalledTimes(2);
  });

  it("throws error when retries exhausted", async () => {
    const prompt = "test prompt";

    const aiSpy = vi.spyOn(aiModule, "aiCall").mockResolvedValue("mock-json");

    vi.spyOn(aiModule, "validateAiResponse").mockImplementation(() => {
      throw new Error("Invalid schema");
    });

    await expect(
      askOpenRouterWithValidation(prompt, "code quality"),
    ).rejects.toThrow("Invalid schema");

    expect(aiSpy).toHaveBeenCalledTimes(2);
  });
});
