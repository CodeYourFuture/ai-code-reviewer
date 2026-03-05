import { Octokit } from "octokit";
import { FeedbackPoint } from "../types/aiResponse.js";
import { CreateReviewCommentParams } from "../types/githubTypes.js";
import { extractReviewParams } from "../utils/extractReviewParams.js";

export async function postInlineComments(
  owner: string,
  repo: string,
  pullNumber: number,
  octokit: Octokit,
  point: FeedbackPoint,
  commitId: string,
) {
  const feedbackParams = extractReviewParams(point);
  for (let i = 0; i < feedbackParams.lines.length; i++) {
    const lineReviewParams = formReviewParams(feedbackParams.lines[i]);
    if (lineReviewParams) {
      const reviewParams: CreateReviewCommentParams = {
        owner,
        repo,
        pull_number: pullNumber,
        commit_id: commitId,
        body: feedbackParams.body,
        path: feedbackParams.path,
        ...lineReviewParams,
        side: "RIGHT",
      };
      await octokit.rest.pulls.createReviewComment(reviewParams);
    }
  }
}
export const formReviewParams = (lineFeedbackParams: number[]) => {
  if (lineFeedbackParams.length === 2) {
    const lineReviewParams = {
      start_line: lineFeedbackParams[0],
      line: lineFeedbackParams[1],
    };
    return lineReviewParams;
  } else if (lineFeedbackParams.length === 1) {
    const lineReviewParams = {
      line: lineFeedbackParams[0],
    };
    return lineReviewParams;
  }
};
