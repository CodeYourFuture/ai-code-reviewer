import type { EmitterWebhookEvent } from "@octokit/webhooks";
import { Octokit } from "octokit";
import { checkMembershipForUser } from "./networks/githubApi/checkMembershipForUser.js";
import { MODEL, runAiReview } from "./networks/ai/ai_api_request.js";
import { getPRFiles, logPRFiles } from "./networks/githubApi/github.js";
import { postInlineComments } from "./networks/githubApi/postInlineComment.js";
import { postPRComment } from "./networks/githubApi/postPrComment.js";
import { AiResponseWithId, ReviewWithPrompt } from "./types/aiResponse.js";
import { storeReview } from "./db/storeReview.js";
import { haveCommentedAlready } from "./networks/githubApi/haveCommentedAlready.js";

const messageForNewPRs =
  "Thanks for opening a new PR! AI started to review it. Please notice that AI will review this PR only once";
const messageWhenNoFeedback =
  "Your code is ready to be reviewed by a volunteer";

export async function handleLabeled(
  event: EmitterWebhookEvent<"pull_request.labeled"> & { octokit: Octokit },
) {
  const { payload, octokit } = event;
  if (!payload.pull_request) return;

  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;
  const pullNumber = payload.pull_request.number;
  const commitId = payload.pull_request.head.sha;
  const label = payload.label?.name;

  console.log(`Received a "labeled" event for PR #${pullNumber}`);

  if (
    process.env.NODE_ENV === "production" &&
    !(await checkMembershipForUser(payload.sender.login, octokit))
  ) {
    console.log("sender isn't a member of cyf");
    return;
  }

  if (
    process.env.NODE_ENV === "production" &&
    (await haveCommentedAlready(owner, repo, pullNumber, octokit))
  ) {
    console.log("This reviewer only review prs once");
    return;
  }

  if (label?.toLocaleLowerCase() === "needs review") {
    try {
      await postPRComment({
        owner,
        repo,
        pullNumber,
        body: messageForNewPRs,
        octokit,
      });
      const files = await getPRFiles(owner, repo, pullNumber, octokit);
      await logPRFiles(owner, repo, pullNumber, files);
      const aiReview: ReviewWithPrompt[] = await runAiReview(files);
      const aiReviewWithId: AiResponseWithId[] = await storeReview(
        aiReview,
        MODEL,
        commitId,
      );
      if (
        aiReviewWithId.some((response) => response.feedback_points.length > 0)
      ) {
        await postInlineComments(
          owner,
          repo,
          pullNumber,
          octokit,
          aiReviewWithId,
          commitId,
        );
      } else {
        await postPRComment({
          owner,
          repo,
          pullNumber,
          body: messageWhenNoFeedback,
          octokit,
        });
      }
    } catch (error) {
      console.error(error);
    }
  } else {
    console.log(`Received label "${label}" isn't "Needs Review"`);
  }
}
