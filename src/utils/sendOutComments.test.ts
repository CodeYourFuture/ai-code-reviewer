import { vi, expect, test, beforeEach } from "vitest";

vi.mock("../networks/githubApi/postInlineComment.js", () => ({
  postInlineComments: vi.fn(),
}));

vi.mock("../networks/githubApi/postPrComment.js", () => ({
  postPRComment: vi.fn(),
}));
beforeEach(() => {
  vi.clearAllMocks();
});
import { sendOutComments } from "./sendOutComments.js";
import { postInlineComments } from "../networks/githubApi/postInlineComment.js";
import { postPRComment } from "../networks/githubApi/postPrComment.js";
import type { AiResponseWithId } from "../types/aiResponse.js";

test("posts PR comment when there is no feedback", async () => {
  const aiReviewWithId: AiResponseWithId[] = [];

  await sendOutComments(
    aiReviewWithId,
    "owner",
    "repo",
    123,
    {} as any,
    "commit-sha",
  );

  expect(postInlineComments).not.toHaveBeenCalled();
  expect(postPRComment).toHaveBeenCalledTimes(1);
});

test("posts feedback when there is feedback available", async () => {
  const aiReviewWithId: AiResponseWithId[] = [
    {
      feedback_type: "code quality",
      feedback_points: [
        {
          file_name: "string",
          point: "string",
          line_numbers: ["12"],
          severity: 4,
          point_id: 1,
        },
      ],
    },
  ];

  await sendOutComments(
    aiReviewWithId,
    "owner",
    "repo",
    123,
    {} as any,
    "commit-sha",
  );

  expect(postInlineComments).toHaveBeenCalledTimes(1);
  expect(postPRComment).not.toHaveBeenCalled();
});
