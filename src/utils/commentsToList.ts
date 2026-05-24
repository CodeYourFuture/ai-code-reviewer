import { formReviewParams } from "../networks/postInlineComment.js";
import { FeedbackPointWithId } from "../types/aiResponse.js";
import type { CreateReviewComment } from "../types/githubTypes.js";
import { extractReviewParams } from "../utils/extractReviewParams.js";
import { env } from "../config/env.js";
export function buildReviewCommentsArray(
  points: FeedbackPointWithId[],
): CreateReviewComment[] {
  const comments: CreateReviewComment[] = [];

  for (const point of points) {
    const feedbackParams = extractReviewParams(point);

    for (const lineRange of feedbackParams.lines) {
      const lineReviewParams = formReviewParams(lineRange);

      if (!lineReviewParams) continue;

      comments.push({
        body: `${feedbackParams.body}
        \nTo "like" or "dislike" this comment, please follow [this link](${env.BASE_URL}/?id=${point.point_id})
        `,
        path: feedbackParams.path,
        side: "RIGHT",
        ...lineReviewParams,
      });
    }
  }

  return comments;
}
