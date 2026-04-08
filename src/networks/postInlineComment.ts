import { Octokit } from "octokit";
import { AiResponse } from "../types/aiResponse.js";
import type { CreateReviewComment } from "../types/githubTypes.js";
import { buildReviewCommentsArray } from "../utils/commentsToList.js";

export async function postInlineComments(
  owner: string,
  repo: string,
  pullNumber: number,
  octokit: Octokit,
  review: AiResponse[],
  commitId: string,
) {
  const commentsQualityReview = review.find(
    (reviewType) => reviewType.feedback_type === "comments quality",
  );

  if (
    commentsQualityReview &&
    commentsQualityReview.feedback_points.length > 3
  ) {
    review = review.filter(
      (feedback) => feedback.feedback_type != "comments quality",
    );
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
