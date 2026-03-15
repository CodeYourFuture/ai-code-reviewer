import { Octokit } from "octokit";
import { FeedbackPoint } from "../types/aiResponse.js";
import { buildReviewCommentsArray } from "../utils/commentsToList.js";

export async function postInlineComments(
  owner: string,
  repo: string,
  pullNumber: number,
  octokit: Octokit,
  points: FeedbackPoint[],
  commitId: string,
) {
  const comments = buildReviewCommentsArray(points);
  if (!comments.length) return;
  await octokit.request(
    "POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews",
    {
      owner,
      repo,
      pull_number: pullNumber,
      commit_id: commitId,
      event: "COMMENT",
      comments,
    },
  );
}
export const formReviewParams = (lineFeedbackParams: number[]) => {
  if (lineFeedbackParams.length === 2) {
    return {
      start_line: lineFeedbackParams[0],
      line: lineFeedbackParams[1],
    };
  }

  if (lineFeedbackParams.length === 1) {
    return {
      line: lineFeedbackParams[0],
    };
  }
};
