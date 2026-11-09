import type { EmitterWebhookEvent } from "@octokit/webhooks";
import type { Octokit } from "octokit";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleLabeled } from "./handleLabeled.js";
import { runAiReview } from "./networks/ai/ai_api_request.js";
import { getPRFiles } from "./networks/githubApi/github.js";
import { postPRComment } from "./networks/githubApi/postPrComment.js";
import { storeReview } from "./db/storeReview.js";
import { sendOutComments } from "./utils/sendOutComments.js";
import { addLabelToPR, removeLabelFromPR } from "./networks/githubApi/handleLabels.js";
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
vi.mock("./networks/ai/ai_api_request.js", () => ({ MODEL: "test-model", runAiReview: vi.fn() }));
vi.mock("./networks/githubApi/handleLabels.js", () => ({
  addLabelToPR: vi.fn(), removeLabelFromPR: vi.fn(),
}));
vi.mock(import("./networks/githubApi/haveCommentedAlready.js"), { spy: true });
vi.mock("./db/storeReview.js", () => ({
  storeReview: vi.fn().mockResolvedValue([]),
}));
vi.mock("./utils/sendOutComments.js", () => ({
  sendOutComments: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("./networks/githubApi/postPrComment.js", () => ({
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
    expect(storeReview).toHaveBeenCalledWith([], expect.anything(), "abc123", {
      repoFullName: "octocat/hello-world", pullRequestNumber: 42,
    });
  });

  it("waits for comments before marking the PR reviewed", async () => {
    let finishPosting!: () => void;
    vi.mocked(sendOutComments).mockReturnValueOnce(new Promise<void>((resolve) => {
      finishPosting = resolve;
    }));
    const event = makeEvent("needs review");
    const workflow = handleLabeled(event);
    await vi.waitFor(() => expect(sendOutComments).toHaveBeenCalled());
    expect(removeLabelFromPR).not.toHaveBeenCalled();
    expect(addLabelToPR).not.toHaveBeenCalled();
    finishPosting();
    await workflow;
    expect(addLabelToPR).toHaveBeenCalledWith(event.octokit, "octocat", "hello-world", 42, "Reviewed");
    expect(postPRComment).toHaveBeenCalled();
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
