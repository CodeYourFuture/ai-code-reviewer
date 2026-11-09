import { afterEach, expect, test, vi } from "vitest";
import { formReviewParams, postInlineComments } from "./postInlineComment.js";
import type { Octokit } from "octokit";
import { storeGithubComment } from "../../db/storeGithubComment.js";

vi.mock("../../db/storeGithubComment.js", () => ({ storeGithubComment: vi.fn() }));
afterEach(() => vi.restoreAllMocks());

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
  const request = vi.fn()
    .mockResolvedValueOnce({ data: { id: 99 } })
    .mockResolvedValueOnce({ data: [] });
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
  expect(request).toHaveBeenCalledTimes(2);
  const params = request.mock.calls[0][1];
  expect(params.comments).toHaveLength(5);
  expect(params.comments[0].body).toContain("Specific finding 0");
  expect(params.body).toBeUndefined();
});

const review = [{
  feedback_type: "code quality" as const,
  feedback_points: [1, 2].map((id) => ({
    point_id: id, file_name: "game.js", point: `Finding ${id}`,
    line_numbers: [String(id)], severity: 3,
  })),
}];

test("matches returned comments to findings by their bodies, not their order", async () => {
  vi.mocked(storeGithubComment).mockClear();
  const request = vi.fn().mockImplementation(async (route, params) => {
    if (route.startsWith("POST")) return { data: { id: 99 } };
    expect(params).toMatchObject({ review_id: 99, page: 1, per_page: 100 });
    const comments = request.mock.calls[0][1].comments;
    return { data: [
      { id: 102, html_url: "https://github.com/comment/102", body: comments[1].body },
      { id: 103, html_url: "https://github.com/comment/103", body: "Unrelated comment" },
      { id: 101, html_url: "https://github.com/comment/101", body: comments[0].body },
    ] };
  });
  await postInlineComments("owner", "repo", 42, { request } as unknown as Octokit, review, "commit");
  expect(storeGithubComment).toHaveBeenCalledTimes(2);
  expect(storeGithubComment).toHaveBeenNthCalledWith(1, 2, 102, "https://github.com/comment/102");
  expect(storeGithubComment).toHaveBeenNthCalledWith(2, 1, 101, "https://github.com/comment/101");
});

test("keeps a posted review successful when the lookup fails, without reposting", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.mocked(storeGithubComment).mockClear();
  const request = vi.fn()
    .mockResolvedValueOnce({ data: { id: 99 } })
    .mockRejectedValueOnce(new Error("GitHub unavailable"));
  await expect(postInlineComments("owner", "repo", 42, { request } as unknown as Octokit, review, "commit")).resolves.toBeUndefined();
  expect(request).toHaveBeenCalledTimes(2);
  expect(storeGithubComment).not.toHaveBeenCalled();
  expect(warn).toHaveBeenCalledWith(expect.stringContaining("could not retrieve"), expect.any(Error));
});

test("continues saving other comments when one metadata update fails", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.mocked(storeGithubComment).mockClear();
  vi.mocked(storeGithubComment).mockRejectedValueOnce(new Error("Database unavailable"));
  const request = vi.fn().mockImplementation(async (route) => {
    if (route.startsWith("POST")) return { data: { id: 99 } };
    return { data: request.mock.calls[0][1].comments.map((comment: { body: string }, i: number) => ({
      id: 101 + i, html_url: `https://github.com/comment/${101 + i}`, body: comment.body,
    })) };
  });
  await expect(postInlineComments("owner", "repo", 42, { request } as unknown as Octokit, review, "commit")).resolves.toBeUndefined();
  expect(storeGithubComment).toHaveBeenCalledTimes(2);
  expect(warn).toHaveBeenCalledWith(expect.stringContaining("Could not save"), expect.any(Error));
});

test("matches comments despite surrounding whitespace and different line endings", async () => {
  vi.mocked(storeGithubComment).mockClear();
  const request = vi.fn().mockImplementation(async (route) => {
    if (route.startsWith("POST")) return { data: { id: 99 } };
    const comments = request.mock.calls[0][1].comments;
    return { data: [
      { id: 101, html_url: "https://github.com/comment/101", body: comments[0].body.trim().replace(/\r\n?/g, "\n") },
      { id: 102, html_url: "https://github.com/comment/102", body: `\r\n ${comments[1].body.trim().replace(/\r?\n/g, "\r\n")} \r\n` },
    ] };
  });
  await postInlineComments("owner", "repo", 42, { request } as unknown as Octokit, review, "commit");
  expect(storeGithubComment).toHaveBeenCalledTimes(2);
  expect(storeGithubComment).toHaveBeenNthCalledWith(1, 1, 101, "https://github.com/comment/101");
  expect(storeGithubComment).toHaveBeenNthCalledWith(2, 2, 102, "https://github.com/comment/102");
});

test("still rejects when posting the review itself fails", async () => {
  const request = vi.fn().mockRejectedValue(new Error("Posting failed"));
  await expect(postInlineComments("owner", "repo", 42, { request } as unknown as Octokit, review, "commit")).rejects.toThrow("Posting failed");
  expect(request).toHaveBeenCalledTimes(1);
});
