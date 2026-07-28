import { postInlineComments } from "../networks/githubApi/postInlineComment.js";
import { postPRComment } from "../networks/githubApi/postPrComment.js";
import type { AiResponseWithId } from "../types/aiResponse.js";
import { Octokit } from "octokit";

export const messageWhenNoFeedback =
  "The CYF AI reviewer had no comments to leave - please wait for a volunteer to review this PR.";

export async function sendOutComments(
  aiReviewWithId: AiResponseWithId[],
  owner: string,
  repo: string,
  pullNumber: number,
  octokit: Octokit,
  commitId: string,
) {
  if (aiReviewWithId.some((response) => response.feedback_points.length > 0)) {
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
}
