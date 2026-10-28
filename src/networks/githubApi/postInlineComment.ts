import { Octokit } from "octokit";
import { AiResponseWithId } from "../../types/aiResponse.js";
import type { CreateReviewComment } from "../../types/githubTypes.js";
import { buildReviewCommentsArray } from "../../utils/commentsToList.js";

export async function postInlineComments(
  owner: string,
  repo: string,
  pullNumber: number,
  octokit: Octokit,
  review: AiResponseWithId[],
  commitId: string,
) {
  const comments: CreateReviewComment[] = review.flatMap((reviewType) => {
    return buildReviewCommentsArray(reviewType.feedback_points);
  });
  if (comments.length) {
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
