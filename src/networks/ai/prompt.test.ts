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
    expect(prompt).toContain("Use a focused discovery question by default");
    expect(prompt).toContain(
      "Do not choose direct explanation merely because you already know the diagnosis",
    );
    expect(prompt).toContain(
      "When several findings are suitable for discovery questions, use questions for most of them",
    );
    expect(prompt).toContain("end the finding there");
    expect(prompt).toContain("Do not answer the question");
    expect(prompt).toContain(
      "Use direct explanation only when a discovery question would remain vague",
    );
    expect(prompt).toContain(
      "Do not append a question merely to make direct feedback sound instructional",
    );
    expect(prompt).toContain('never use the pattern "Question? Answer."');
    expect(prompt).toContain(
      "If any sentence answers the question or gives away the conclusion",
    );
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
