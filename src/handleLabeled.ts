import type { EmitterWebhookEvent } from "@octokit/webhooks";
import { Octokit } from "octokit";
import { checkMembershipForUser } from "./networks/githubApi/checkMembershipForUser.js";
import { MODEL, runAiReview } from "./networks/ai/ai_api_request.js";
import { getPRFiles, logPRFiles } from "./networks/githubApi/github.js";
import { AiResponseWithId, ReviewWithPrompt } from "./types/aiResponse.js";
import { storeReview } from "./db/storeReview.js";
import { haveCommentedAlready } from "./networks/githubApi/haveCommentedAlready.js";
import { sendOutComments } from "./utils/sendOutComments.js";
import {
  addLabelToPR,
  removeLabelFromPR,
} from "./networks/githubApi/handleLabels.js";
import { postPRComment } from "./networks/githubApi/postPrComment.js";

const messageForReviewedPrs =
  "The CYF AI review has left comments. It will only review a PR one time. When you have addressed these comments, please request review again and a volunteer will take a look.";

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
      const files = await getPRFiles(owner, repo, pullNumber, octokit);
      await logPRFiles(owner, repo, pullNumber, files);
      const aiReview: ReviewWithPrompt[] = await runAiReview(files);
      const aiReviewWithId: AiResponseWithId[] = await storeReview(
        aiReview,
        MODEL,
        commitId,
      );
      sendOutComments(
        aiReviewWithId,
        owner,
        repo,
        pullNumber,
        octokit,
        commitId,
      );
      await removeLabelFromPR(octokit, owner, repo, pullNumber, "Needs Review");
      await addLabelToPR(octokit, owner, repo, pullNumber, "Reviewed");
      await postPRComment({
        owner,
        repo,
        pullNumber,
        body: messageForReviewedPrs,
        octokit,
      });
    } catch (error) {
      console.error(error);
    }
  } else {
    console.log(`Received label "${label}" isn't "Needs Review"`);
  }
}
