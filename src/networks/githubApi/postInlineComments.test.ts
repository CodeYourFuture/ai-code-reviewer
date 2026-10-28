import { expect, test, vi } from "vitest";
import { formReviewParams, postInlineComments } from "./postInlineComment.js";
import type { Octokit } from "octokit";

// These formatting tests do not need deployment credentials or a local .env.
vi.mock("../../config/env.js", () => ({
  env: { FRONTEND_BASE_URL: "https://feedback.example" },
}));

test("create start line and line when two numbers", () => {
  expect(formReviewParams([46, 49])).toEqual({ start_line: 46, line: 49 });
});
test("return line when one number passed", () => {
  expect(formReviewParams([46])).toEqual({ line: 46 });
});

test("posts five comment findings inline without replacing them with a generic review", async () => {
  const request = vi.fn().mockResolvedValue({});
  await postInlineComments("owner", "repo", 42, { request } as unknown as Octokit, [{
    feedback_type: "comments quality",
    feedback_points: Array.from({ length: 5 }, (_, index) => ({
      file_name: "game.js",
      point: `Specific finding ${index}`,
      line_numbers: [String(index + 1)],
      severity: 2,
      point_id: index + 1,
    })),
  }], "commit");
  expect(request).toHaveBeenCalledTimes(1);
  const params = request.mock.calls[0][1];
  expect(params.comments).toHaveLength(5);
  expect(params.comments[0].body).toContain("Specific finding 0");
  expect(params.body).toBeUndefined();
});

test.todo("Function sends post request with the right params");
test.todo("Function throws error when passing incorrect params");
test.todo("throws error if github return error");
