import { AiResponse } from "../types/aiResponse.js";
import { describe, expect, it } from "vitest";
import { removeAdditionalLineNumbers } from "./ai_api_request.js";

const review: AiResponse = {
  feedback_type: "code quality",
  feedback_points: [
    {
      file_name: "file1.js",
      topics: ["bad naming"],
      point: "Consider renaming this variable",
      line_numbers: ["3-9,11-23,17-21"],
      severity: 4,
    },
    {
      file_name: "file2.js",
      topics: ["duplicated code"],
      point: "Extract this into a function",
      line_numbers: ["3-9, 11-23, 17-21"],
      severity: 4,
    },
  ],
};

describe("removeAdditionalLineNumbers", () => {
  it("it removes additional lines", () => {
    const removed = removeAdditionalLineNumbers(review);
    expect(removed.feedback_points[0].line_numbers).toEqual(["3-9"]);
  });
});
