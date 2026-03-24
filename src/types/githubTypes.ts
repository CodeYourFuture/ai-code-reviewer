import type { RestEndpointMethodTypes } from "@octokit/plugin-rest-endpoint-methods";

export type PullRequestFilesResponse =
  RestEndpointMethodTypes["pulls"]["listFiles"]["response"];

export type PRFile = PullRequestFilesResponse["data"][number];

//type for single comments on diff
export type CreateReviewCommentParams =
  RestEndpointMethodTypes["pulls"]["createReviewComment"]["parameters"];

export type CreateReviewForPR =
  RestEndpointMethodTypes["pulls"]["createReview"]["parameters"];

//type for one element from array of comments to include in one pr review
export type CreateReviewComment = NonNullable<
  CreateReviewForPR["comments"]
>[number];
