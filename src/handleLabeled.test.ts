import type { EmitterWebhookEvent } from "@octokit/webhooks";
import type { Octokit } from "octokit";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleLabeled } from "./handleLabeled.js";
import { runAiReview } from "./networks/ai/ai_api_request.js";
import { getPRFiles } from "./networks/githubApi/github.js";
import { postPRComment } from "./networks/githubApi/postPrComment.js";
import { storeReview } from "./db/storeReview.js";
import { messageWhenNoFeedback } from "./utils/sendOutComments.js";
import { postInlineComments } from "./networks/githubApi/postInlineComment.js";
import type { AiResponseWithId } from "./types/aiResponse.js";
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
      sender: { login: "Droid-An", type: "User" },
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
vi.mock("./networks/githubApi/postInlineComment.js", () => ({
  postInlineComments: vi.fn(),
}));
vi.mock("./networks/githubApi/postPrComment.js", () => ({
  postPRComment: vi.fn(),
}));

const reviewWithFeedback: AiResponseWithId[] = [{
  feedback_type: "code quality",
  feedback_points: [{
    file_name: "index.js", point: "Check this value", line_numbers: ["12"],
    severity: 4, point_id: 1,
  }],
}];

describe("handleLabeled", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPRFiles).mockResolvedValue([]);
    vi.mocked(runAiReview).mockResolvedValue([]);
    vi.mocked(storeReview).mockResolvedValue([]);
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
    vi.mocked(storeReview).mockResolvedValue(reviewWithFeedback);
    vi.mocked(postInlineComments).mockReturnValueOnce(new Promise<void>((resolve) => {
      finishPosting = resolve;
    }));
    const event = makeEvent("needs review");
    const workflow = handleLabeled(event);
    await vi.waitFor(() => expect(postInlineComments).toHaveBeenCalled());
    expect(removeLabelFromPR).not.toHaveBeenCalled();
    expect(addLabelToPR).not.toHaveBeenCalled();
    finishPosting();
    await workflow;
    expect(addLabelToPR).toHaveBeenCalledWith(event.octokit, "octocat", "hello-world", 42, "Reviewed");
    expect(postPRComment).toHaveBeenCalled();
  });

  describe.each([true, false])("multiple reviews allowed: %s", (multipleReviewsAllowed) => {
    beforeEach(() => {
      (env as { MULTIPLE_REVIEWS_ALLOWED: boolean }).MULTIPLE_REVIEWS_ALLOWED = multipleReviewsAllowed;
    });

    it.each([
      { name: "an empty review", review: [] },
      { name: "empty feedback groups", review: [
        { feedback_type: "code quality", feedback_points: [] },
        { feedback_type: "comments quality", feedback_points: [] },
      ] },
    ] satisfies { name: string; review: AiResponseWithId[] }[])(
      "keeps $name available for volunteer review", async ({ review }) => {
        vi.mocked(storeReview).mockResolvedValue(review);
        const event = makeEvent("Needs Review");

        await handleLabeled(event);

        expect(postInlineComments).not.toHaveBeenCalled();
        expect(postPRComment).toHaveBeenCalledExactlyOnceWith({
          owner: "octocat", repo: "hello-world", pullNumber: 42,
          octokit: event.octokit, body: messageWhenNoFeedback,
        });
        expect(addLabelToPR).toHaveBeenCalledExactlyOnceWith(
          event.octokit, "octocat", "hello-world", 42, "Needs Review",
        );
        expect(removeLabelFromPR).toHaveBeenCalledExactlyOnceWith(
          event.octokit, "octocat", "hello-world", 42, "Reviewed",
        );
      },
    );

    it("marks findings reviewed and posts the appropriate follow-up", async () => {
      vi.mocked(storeReview).mockResolvedValue(reviewWithFeedback);
      const event = makeEvent("Needs Review");

      await handleLabeled(event);

      expect(postInlineComments).toHaveBeenCalledExactlyOnceWith(
        "octocat", "hello-world", 42, event.octokit, reviewWithFeedback, "abc123",
      );
      expect(addLabelToPR).toHaveBeenCalledExactlyOnceWith(
        event.octokit, "octocat", "hello-world", 42, "Reviewed",
      );
      expect(removeLabelFromPR).toHaveBeenCalledExactlyOnceWith(
        event.octokit, "octocat", "hello-world", 42, "Needs Review",
      );
      expect(postPRComment).toHaveBeenCalledExactlyOnceWith({
        owner: "octocat", repo: "hello-world", pullNumber: 42,
        octokit: event.octokit,
        body: multipleReviewsAllowed
          ? "The CYF AI review has left comments. When you have addressed these comments, you can request another AI review or ask a volunteer to take a look."
          : "The CYF AI review has left comments. It will only review a PR one time. When you have addressed these comments, please request review again and a volunteer will take a look.",
      });
    });

    it("ignores bot-generated Needs Review label events", async () => {
      const event = makeEvent("Needs Review");
      event.payload.sender.type = "Bot";

      await handleLabeled(event);

      expect(haveCommentedAlready).not.toHaveBeenCalled();
      expect(runAiReview).not.toHaveBeenCalled();
      expect(postPRComment).not.toHaveBeenCalled();
      expect(addLabelToPR).not.toHaveBeenCalled();
      expect(removeLabelFromPR).not.toHaveBeenCalled();
    });
  });

  it.each([true, false])("does not change labels when posting fails (has feedback: %s)", async (hasFeedback) => {
    const error = new Error("GitHub unavailable");
    const logError = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(storeReview).mockResolvedValue(hasFeedback ? reviewWithFeedback : []);
    if (hasFeedback) {
      vi.mocked(postInlineComments).mockRejectedValueOnce(error);
    } else {
      vi.mocked(postPRComment).mockRejectedValueOnce(error);
    }

    try {
      await handleLabeled(makeEvent("Needs Review"));

      expect(addLabelToPR).not.toHaveBeenCalled();
      expect(removeLabelFromPR).not.toHaveBeenCalled();
      expect(postPRComment).toHaveBeenCalledTimes(hasFeedback ? 0 : 1);
      expect(logError).toHaveBeenCalledWith(error);
    } finally {
      logError.mockRestore();
    }
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
