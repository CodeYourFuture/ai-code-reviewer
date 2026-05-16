import { describe, expect, it } from "vitest";
import { storeReview } from "./storeReview.js";
import { AiResponse } from "../types/aiResponse.js";
import { MODEL } from "../networks/ai_api_request.js";

// vi.mock("./storeReview.js", () => ({
//   addFeedbackPoint: vi.fn(()=>
//   )
// }));
describe("it stores data to db", () => {
  it("return feedback points with point_id", async () => {
    const validatedReview: AiResponse[] = [
      {
        feedback_type: "code quality",
        feedback_points: [
          {
            file_name: "file1.js",
            topics: ["bad naming"],
            point: "Consider renaming this variable",
            line_numbers: ["8"],
            severity: 4,
          },
          {
            file_name: "file2.js",
            topics: ["duplicated code"],
            point: "Extract this into a function",
            line_numbers: ["1-3"],
            severity: 4,
          },
        ],
      },
      { feedback_type: "comments quality", feedback_points: [] },
    ];
    const sha = "689657685965865";
    const codeQualityPrompt = "prompt";
    const commentQualityPrompt = "prompt2";
    const reviewWithIds = await storeReview(validatedReview, MODEL, sha, [
      codeQualityPrompt,
      commentQualityPrompt,
    ]);

    expect(reviewWithIds).toEqual([
      {
        feedback_type: "code quality",
        feedback_points: [
          {
            file_name: "file1.js",
            topics: ["bad naming"],
            point: "Consider renaming this variable",
            line_numbers: ["8"],
            severity: 4,
            point_id: 1,
          },
          {
            file_name: "file2.js",
            topics: ["duplicated code"],
            point: "Extract this into a function",
            line_numbers: ["1-3"],
            severity: 4,
            point_id: 2,
          },
        ],
      },
      { feedback_type: "comments quality", feedback_points: [] },
    ]);
    // const aiSpy = vi.spyOn(aiModule, "aiCall").mockResolvedValue("mock-json");

    // const validateSpy = vi
    //   .spyOn(aiModule, "validateAiResponse")
    //   .mockReturnValue(mockFeedback);

    // const result = await askOpenRouterWithValidation(prompt, "code quality");

    // expect(result).toEqual(mockFeedback);
    // expect(aiSpy).toHaveBeenCalledTimes(1);
    // expect(validateSpy).toHaveBeenCalledTimes(1);
  });
});
