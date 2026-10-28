import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AiResponse } from "../../types/aiResponse.js";
import type { PRFile } from "../../types/githubTypes.js";
import { runAiReview, validateAiResponse } from "./ai_api_request.js";
import { askOpenRouterWithValidation } from "./retryWithValidation.js";
import { codeReviewPrompt } from "./prompt.js";

vi.mock("../../config/env.js", () => ({ env: { OPENROUTER_API_KEY: "test" } }));
vi.mock("@openrouter/sdk", () => ({ OpenRouter: class {} }));
vi.mock("./retryWithValidation.js", () => ({ askOpenRouterWithValidation: vi.fn() }));

const point: AiResponse["feedback_points"][number] = {
  feedback_type: "code quality",
  file_name: "game.js",
  topic: "clarity",
  point: "This name suggests elapsed time but stores a score. What name would convey its purpose?",
  line_numbers: ["1"],
  severity: 2,
};
const patch = "@@ -1,2 +1,2 @@\n-old code\n+new code\n // context";
const makeFiles = () => [{ filename: "game.js", status: "modified", patch } as PRFile];

describe("single-pass review", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("sends one combined request and preserves useful low-severity and comment findings", async () => {
    const comment = { ...point, feedback_type: "comments quality" as const, topic: "comments" };
    vi.mocked(askOpenRouterWithValidation).mockResolvedValue({ feedback_points: [point, comment] });
    const files = makeFiles();
    const result = await runAiReview(files);

    expect(askOpenRouterWithValidation).toHaveBeenCalledTimes(1);
    expect(askOpenRouterWithValidation).toHaveBeenCalledWith([
      { role: "system", content: codeReviewPrompt },
      { role: "user", content: expect.stringContaining("1| +new code") },
    ], expect.objectContaining({ maxCompletionTokens: 6000 }));
    expect(result.map((review) => review.feedback_points.length)).toEqual([1, 1]);
    expect(result[0].feedback_points[0].topic).toBe("clarity");
    expect(result.every((review) => review.prompt === codeReviewPrompt)).toBe(true);
    expect(files[0].patch).toBe(patch);
  });

  it("allows an empty review", async () => {
    vi.mocked(askOpenRouterWithValidation).mockResolvedValue({ feedback_points: [] });
    expect((await runAiReview(makeFiles())).every((review) => !review.feedback_points.length)).toBe(true);
  });

  it("propagates a failed request rather than returning a successful empty review", async () => {
    vi.mocked(askOpenRouterWithValidation).mockRejectedValue(new Error("provider unavailable"));
    await expect(runAiReview(makeFiles())).rejects.toThrow("provider unavailable");
  });

  it("validates a global maximum of five findings across both types", () => {
    const points = Array.from({ length: 5 }, () => ({ ...point }));
    expect(validateAiResponse(JSON.stringify({ feedback_points: points })).feedback_points).toHaveLength(5);
    expect(() => validateAiResponse(JSON.stringify({ feedback_points: [...points, {
      ...point, feedback_type: "comments quality",
    }] }))).toThrow();
  });

  it("rejects findings without an anchor or valid feedback type", () => {
    for (const invalid of [{ ...point, line_numbers: [] }, { ...point, feedback_type: "unknown" }]) {
      expect(() => validateAiResponse(JSON.stringify({ feedback_points: [invalid] }))).toThrow();
    }
  });
});
