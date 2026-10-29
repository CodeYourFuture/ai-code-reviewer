import type { EmitterWebhookEvent } from "@octokit/webhooks";
import type { Octokit } from "octokit";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleLabeled } from "./handleLabeled.js";
import { runAiReview } from "./networks/ai/ai_api_request.js";
import { getPRFiles } from "./networks/githubApi/github.js";
import { postInlineComments } from "./networks/githubApi/postInlineComment.js";
import { postPRComment } from "./networks/githubApi/postPrComment.js";
import { haveCommentedAlready } from "./networks/githubApi/haveCommentedAlready.js";
import { env } from "./config/env.js";

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

vi.mock("./config/env.js", () => ({
  env: {
    NODE_ENV: "development",
    DEV_GITHUB_USER_ALLOWLIST: ["droid-an"],
    GITHUB_MEMBERSHIP_ORG: "ExampleOrg",
    MULTIPLE_REVIEWS_ALLOWED: true,
  },
}));

vi.mock(import("./networks/githubApi/github.js"), { spy: true });
vi.mock(import("./networks/ai/ai_api_request.js"), { spy: true });
vi.mock(import("./networks/githubApi/haveCommentedAlready.js"), { spy: true });
vi.mock("./networks/postInlineComment.js", () => ({
  postInlineComments: vi.fn(),
}));
vi.mock("./networks/postPrComment.js", () => ({
  postPRComment: vi.fn(),
}));

describe("handleLabeled", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPRFiles).mockResolvedValue([]);
    vi.mocked(runAiReview).mockResolvedValue([]);
    vi.mocked(haveCommentedAlready).mockResolvedValue(false);
    (env as { MULTIPLE_REVIEWS_ALLOWED: boolean }).MULTIPLE_REVIEWS_ALLOWED = true;
  });

  it("runs AI review workflow when 'needs review' label is applied", async () => {
    const event = makeEvent("needs review");

    await handleLabeled(event);

    expect(getPRFiles).toHaveBeenCalledWith(
      "octocat",
      "hello-world",
      42,
      expect.anything(),
      "abc123",
    );
    expect(runAiReview).toHaveBeenCalled();
  });

  it("does not review PRs triggered by a user outside the development allowlist", async () => {
    const event = makeEvent("needs review");
    event.payload.sender.login = "someone-else";
    await handleLabeled(event);
    expect(getPRFiles).not.toHaveBeenCalled();
    expect(runAiReview).not.toHaveBeenCalled();
  });

  it("allows another review without checking history when multiple reviews are enabled", async () => {
    await handleLabeled(makeEvent("needs review"));

    expect(haveCommentedAlready).not.toHaveBeenCalled();
    expect(runAiReview).toHaveBeenCalled();
  });

  it("does not review again when multiple reviews are disabled", async () => {
    (env as { MULTIPLE_REVIEWS_ALLOWED: boolean }).MULTIPLE_REVIEWS_ALLOWED = false;
    vi.mocked(haveCommentedAlready).mockResolvedValue(true);

    await handleLabeled(makeEvent("needs review"));

    expect(haveCommentedAlready).toHaveBeenCalled();
    expect(getPRFiles).not.toHaveBeenCalled();
    expect(runAiReview).not.toHaveBeenCalled();
  });
});
