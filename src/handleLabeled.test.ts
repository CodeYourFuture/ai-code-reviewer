import type { EmitterWebhookEvent } from "@octokit/webhooks";
import type { Octokit } from "octokit";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleLabeled } from "./handleLabeled.js";
import { runAiReview } from "./networks/ai_api_request.js";
import { getPRFiles } from "./networks/github.js";
import { postInlineComments } from "./networks/postInlineComment.js";
import { postPRComment } from "./networks/postPrComment.js";

function makeEvent(labelName: string, sha = "abc123") {
  return {
    payload: {
      label: { name: labelName },
      repository: {
        owner: { login: "octocat" },
        name: "hello-world",
      },
      sender: { login: "Droid-An" },
      pull_request: {
        number: 42,
        head: { sha },
      },
    },
    octokit: {
      request: vi.fn().mockResolvedValue({ status: 204 }) as any,
    } as Octokit,
  } as unknown as EmitterWebhookEvent<"pull_request.labeled"> & {
    octokit: Octokit;
  };
}

// Mock dependencies used in handleLabeled
vi.mock("./networks/github.js", () => ({
  getPRFiles: vi
    .fn()
    .mockResolvedValue([{ filename: "file1.js" }, { filename: "file2.js" }]),
  logPRFiles: vi.fn(),
}));
vi.mock("./networks/ai_api_request.js", () => ({
  runAiReview: vi.fn().mockResolvedValue({
    feedback_points: [{ message: "fix this" }, { message: "fix that" }],
  }),
}));
vi.mock("./networks/postInlineComment.js", () => ({
  postInlineComments: vi.fn(),
}));
vi.mock("./networks/postPrComment.js", () => ({
  postPRComment: vi.fn(),
}));

describe("handleLabeled", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs AI review workflow when 'needs review' label is applied", async () => {
    // Arrange
    const event = makeEvent("needs review");

    // Act
    await handleLabeled(event);

    // Assert
    expect(getPRFiles).toHaveBeenCalledWith(
      "octocat",
      "hello-world",
      42,
      expect.anything(),
    );
    expect(runAiReview).toHaveBeenCalledWith([
      { filename: "file1.js" },
      { filename: "file2.js" },
    ]);
    expect(postPRComment).toBeCalled();
    expect(postInlineComments).toHaveBeenNthCalledWith(
      1,
      "octocat",
      "hello-world",
      42,
      expect.anything(),
      { message: "fix this" },
      "abc123",
    );
  });
});
