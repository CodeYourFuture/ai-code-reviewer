import { Octokit } from "octokit";
import { AiResponseWithId } from "../../types/aiResponse.js";
import type { CreateReviewComment } from "../../types/githubTypes.js";
import { buildReviewCommentsArray } from "../../utils/commentsToList.js";
import { storeGithubComment } from "../../db/storeGithubComment.js";

function normalizeCommentBody(body: string): string {
  return body.replace(/\r\n?/g, "\n").trim();
}

export async function postInlineComments(
  owner: string,
  repo: string,
  pullNumber: number,
  octokit: Octokit,
  review: AiResponseWithId[],
  commitId: string,
) {
  // Keep our IDs separate from GitHub's payload. Match by body rather than
  // response order: each body contains the finding's unique rating link.
  const pointIdsByBody = new Map<string, number>();
  const comments: CreateReviewComment[] = review.flatMap((reviewType) =>
    reviewType.feedback_points.flatMap((point) => {
      const pointComments = buildReviewCommentsArray([point]);
      for (const comment of pointComments) {
        pointIdsByBody.set(normalizeCommentBody(comment.body), point.point_id);
      }
      return pointComments;
    }),
  );
  if (comments.length) {
    const response = await octokit.request(
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
    // Posting is essential; looking up and saving its metadata is best effort.
    // Never retry posting a successful review if this enrichment fails.
    try {
      for (let page = 1; ; page++) {
        const { data } = await octokit.request(
          "GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}/comments",
          {
            owner, repo, pull_number: pullNumber,
            review_id: response.data.id, per_page: 100, page,
          },
        );
        for (const comment of data) {
          const pointId = pointIdsByBody.get(normalizeCommentBody(comment.body));
          if (pointId === undefined) continue;
          try {
            await storeGithubComment(pointId, comment.id, comment.html_url);
          } catch (error) {
            console.warn(`Could not save GitHub comment for finding ${pointId}:`, error);
          }
        }
        if (data.length < 100) break;
      }
    } catch (error) {
      console.warn("Review posted, but could not retrieve GitHub comment metadata:", error);
    }
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
