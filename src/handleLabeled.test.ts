import type { EmitterWebhookEvent } from "@octokit/webhooks";
import type { Octokit } from "octokit";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleLabeled } from "./handleLabeled.js";
import { runAiReview } from "./networks/ai/ai_api_request.js";
import { getPRFiles } from "./networks/githubApi/github.js";
import { postInlineComments } from "./networks/githubApi/postInlineComment.js";
import { postPRComment } from "./networks/githubApi/postPrComment.js";

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

vi.mock(import("./networks/githubApi/github.js"), { spy: true });
vi.mock(import("./networks/ai/ai_api_request.js"), { spy: true });
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
    const event = makeEvent("needs review");

    await handleLabeled(event);

    expect(getPRFiles).toHaveBeenCalledWith(
      "octocat",
      "hello-world",
      42,
      expect.anything(),
    );
    expect(runAiReview).toHaveBeenCalled();
  });
});
