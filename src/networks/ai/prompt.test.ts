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
    expect(prompt).toContain("Give the smallest clue");
    expect(prompt).toContain("Do not turn feedback into a guessing game");
    expect(prompt).toContain("For severe, subtle, or potentially harmful issues");
  });
});
