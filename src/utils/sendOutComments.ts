import { postInlineComments } from "../networks/githubApi/postInlineComment.js";
import { postPRComment } from "../networks/githubApi/postPrComment.js";
import type { AiResponseWithId } from "../types/aiResponse.js";
import { Octokit } from "octokit";

export const messageWhenNoFeedback =
  "The CYF AI reviewer checked this PR did not find any obvious problems. Please wait for a volunteer to also have a look and offer their own feedback.";

export async function sendOutComments(
  aiReviewWithId: AiResponseWithId[],
  owner: string,
  repo: string,
  pullNumber: number,
  octokit: Octokit,
  commitId: string,
): Promise<"feedback-posted" | "no-feedback"> {
  if (aiReviewWithId.some((response) => response.feedback_points.length > 0)) {
    await postInlineComments(
      owner,
      repo,
      pullNumber,
      octokit,
      aiReviewWithId,
      commitId,
    );
    return "feedback-posted";
  } else {
    await postPRComment({
      owner,
      repo,
      pullNumber,
      body: messageWhenNoFeedback,
      octokit,
    });
    return "no-feedback";
  }
}
