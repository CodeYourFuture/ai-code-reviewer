import { AiResponse, type ReviewWithPrompt } from "../types/aiResponse.js";
import { describe, expect, it } from "vitest";
import { removeAdditionalLineNumbersAndSymbols } from "../validation/removeAdditionalLineNumbersAndSymbols.js";

const review: ReviewWithPrompt = {
  feedback_type: "code quality",
  feedback_points: [
    {
      file_name: "file1.js",
      topic: "bad naming",
      point: "Consider renaming this variable",
      line_numbers: ["3-9,11-23,17-21"],
      severity: 4,
    },
    {
      file_name: "file2.js",
      topic: "duplicated code",
      point: "Extract this into a function",
      line_numbers: ["3-9, 11-23, 17-21"],
      severity: 4,
    },
  ],
  prompt: "prompt",
};

describe("removeAdditionalLineNumbers", () => {
  it("it removes additional lines", () => {
    const removed = removeAdditionalLineNumbersAndSymbols(review);
    expect(removed[0].line_numbers).toEqual(["3-9"]);
  });
});
