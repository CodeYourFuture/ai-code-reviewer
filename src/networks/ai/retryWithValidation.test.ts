import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedbackResponse } from "../../types/aiResponse.js";
import * as aiModule from "../ai_api_request.js";
import { retryWithValidation } from "./retryWithValidation.js";

const mockFeedback: FeedbackResponse = {
  feedback_points: [
    {
      file_name: "file.ts",
      summary: "summary",
      description: "description",
      questions: "question",
      line_numbers: "10",
      severity: 1,
    },
  ],
};

describe("retryWithValidation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("calls aiCall only once when response is valid", async () => {
    const prompt = "test prompt";

    const mockFeedback: FeedbackResponse = {
      feedback_points: [
        {
          file_name: "file.ts",
          summary: "summary",
          description: "description",
          questions: "question",
          line_numbers: "10",
          severity: 1,
        },
      ],
    };

    const aiSpy = vi.spyOn(aiModule, "aiCall").mockResolvedValue("mock-json");

    const validateSpy = vi
      .spyOn(aiModule, "validateFeedbackResponse")
      .mockReturnValue(mockFeedback);

    const result = await retryWithValidation(prompt);

    expect(result).toEqual(mockFeedback);
    expect(aiSpy).toHaveBeenCalledTimes(1);
    expect(validateSpy).toHaveBeenCalledTimes(1);
  });

  it("retries when validation fails once", async () => {
    const prompt = "test prompt";

    const aiSpy = vi.spyOn(aiModule, "aiCall").mockResolvedValue("mock-json");

    const validateSpy = vi
      .spyOn(aiModule, "validateFeedbackResponse")
      .mockImplementationOnce(() => {
        throw new Error("Invalid schema");
      })
      .mockReturnValueOnce(mockFeedback);

    const result = await retryWithValidation(prompt);

    expect(result).toEqual(mockFeedback);
    expect(aiSpy).toHaveBeenCalledTimes(2);
    expect(validateSpy).toHaveBeenCalledTimes(2);
  });

  it("throws error when retries exhausted", async () => {
    const prompt = "test prompt";

    const aiSpy = vi.spyOn(aiModule, "aiCall").mockResolvedValue("mock-json");

    vi.spyOn(aiModule, "validateFeedbackResponse").mockImplementation(() => {
      throw new Error("Invalid schema");
    });

    await expect(retryWithValidation(prompt, 1)).rejects.toThrow(
      "Invalid schema",
    );

    expect(aiSpy).toHaveBeenCalledTimes(2);
  });
});
