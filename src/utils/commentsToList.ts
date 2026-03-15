import { formReviewParams } from "../networks/postInlineComment.js";
import { FeedbackPoint } from "../types/aiResponse.js";
import type { CreateReviewComment } from "../types/githubTypes.js";
import { extractReviewParams } from "../utils/extractReviewParams.js";

export function buildReviewCommentsArray(
  points: FeedbackPoint[],
): CreateReviewComment[] {
  const comments: CreateReviewComment[] = [];

  for (const point of points) {
    const feedbackParams = extractReviewParams(point);

    for (const lineRange of feedbackParams.lines) {
      const lineReviewParams = formReviewParams(lineRange);

      if (!lineReviewParams) continue;

      comments.push({
        body: feedbackParams.body,
        path: feedbackParams.path,
        side: "RIGHT",
        ...lineReviewParams,
      });
    }
  }

  return comments;
}
