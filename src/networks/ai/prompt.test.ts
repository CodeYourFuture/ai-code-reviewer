import { describe, expect, it } from "vitest";
import { createCodeReviewPrompt } from "./prompt.js";

describe("code review prompt", () => {
  it("uses the supplied maximum number of findings", () => {
    const prompt = createCodeReviewPrompt(8);

    expect(prompt).toContain("Return at most 8 distinct findings");
    expect(prompt).toContain("This is a maximum, not a target");
  });

  it("asks for concise, conversational feedback that leads the student", () => {
    const prompt = createCodeReviewPrompt(5);

    expect(prompt).toContain("professional, conversational, warm, and direct");
    expect(prompt).toContain("normally one or two short sentences");
    expect(prompt).toContain("prefer a focused leading question");
    expect(prompt).toContain("end the finding with the question");
    expect(prompt).toContain("Do not answer it in the same finding");
    expect(prompt).toContain("A request phrased as a question is still a suggestion");
    expect(prompt).toContain("Give the smallest clue");
    expect(prompt).toContain("Do not turn feedback into a guessing game");
    expect(prompt).toContain("For severe, subtle, or potentially harmful issues");
  });

  it("prioritizes realistic course-relevant issues over language quirks", () => {
    const prompt = createCodeReviewPrompt(8);

    expect(prompt).toContain(
      "normal use, realistic boundary cases, visible requirements",
    );
    expect(prompt).toContain("Having room for more findings is not a reason");
    expect(prompt).toContain("Do not prioritize unusual language quirks");
    expect(prompt).toContain(
      "If the expected behavior for an unusual edge case is ambiguous, omit the finding",
    );
    expect(prompt).toContain(
      "Prefer a smaller set of course-relevant findings over exhaustive coverage",
    );
  });
});
