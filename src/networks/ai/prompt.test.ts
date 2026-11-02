import { describe, expect, it } from "vitest";
import { createCodeReviewPrompt } from "./prompt.js";

describe("code review prompt", () => {
  it("uses the supplied maximum number of findings", () => {
    const prompt = createCodeReviewPrompt(8);

    expect(prompt).toContain("Return at most 8 distinct findings");
    expect(prompt).toContain("This is a maximum, not a target");
  });
});
