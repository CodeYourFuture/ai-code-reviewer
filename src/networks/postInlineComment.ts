import { Octokit } from "octokit";
import { octokit } from "../testApp";
import { FeedbackPoint } from "../types/aiResponse";
import { CreateReviewCommentParams } from "../types/githubTypes";
import { extractReviewParams } from "../utils/extractReviewParams";
import aiReview from "../utils/sampleOutput/aiReviews/11list.json";

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
//TEST
//This is how I check that this function construct proper request to post inline comments
// TODO: write better tests, so that I don't have to trigger api
const owner = "Droid-An";
const repo = "Module-Data-Flows";
const pullNumber = 1;
const commitId = "2f6b58694bad52e2e721c3c94f44a6ccfbe92dec";
for (const point of aiReview.feedback_points) {
  postInlineComments(owner, repo, pullNumber, octokit, point, commitId);
}
