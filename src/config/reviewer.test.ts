import { describe, expect, it } from "vitest";
import { reviewerConfigSchema } from "./reviewer.js";

describe("reviewer configuration", () => {
  it("provides the documented defaults", () => {
    expect(reviewerConfigSchema.parse({})).toEqual({
      AI_MODEL: "openai/gpt-6-luna",
      AI_REASONING_EFFORT: "medium",
      AI_MAX_COMPLETION_TOKENS: 25000,
      MULTIPLE_REVIEWS_ALLOWED: true,
    });
  });

  it("parses environment variable strings", () => {
    expect(
      reviewerConfigSchema.parse({
        AI_MODEL: "openai/gpt-6-sol",
        AI_REASONING_EFFORT: "high",
        AI_MAX_COMPLETION_TOKENS: "32000",
        MULTIPLE_REVIEWS_ALLOWED: "false",
      }),
    ).toEqual({
      AI_MODEL: "openai/gpt-6-sol",
      AI_REASONING_EFFORT: "high",
      AI_MAX_COMPLETION_TOKENS: 32000,
      MULTIPLE_REVIEWS_ALLOWED: false,
    });
  });

  it("rejects invalid values", () => {
    expect(
      reviewerConfigSchema.safeParse({ AI_REASONING_EFFORT: "extreme" }).success,
    ).toBe(false);
    expect(
      reviewerConfigSchema.safeParse({ AI_MAX_COMPLETION_TOKENS: 0 }).success,
    ).toBe(false);
    expect(
      reviewerConfigSchema.safeParse({ MULTIPLE_REVIEWS_ALLOWED: "yes" }).success,
    ).toBe(false);
  });
});
