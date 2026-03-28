import { Octokit } from "octokit";
import { AiResponse } from "../types/aiResponse.js";
import { buildReviewCommentsArray } from "../utils/commentsToList.js";
import type { CreateReviewComment } from "../types/githubTypes.js";

export async function postInlineComments(
  owner: string,
  repo: string,
  pullNumber: number,
  octokit: Octokit,
  review: AiResponse,
  commitId: string,
) {
  const points = review.feedback_points;
  if (review.feedback_type === "comments quality") {
    const amountOfAiComments = points.length;
    if (amountOfAiComments > 3) {
      await octokit.request(
        "POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews",
        {
          owner,
          repo,
          pull_number: pullNumber,
          commit_id: commitId,
          event: "COMMENT",
          body: "There are many code comment that doesn't provide much value. Could you please check if some comments can be removed, for example comments that just repeat what code does?",
        },
      );
    }
  } else {
    const comments: CreateReviewComment[] = buildReviewCommentsArray(points);
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
