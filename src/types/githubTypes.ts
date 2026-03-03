import type { RestEndpointMethodTypes } from "@octokit/plugin-rest-endpoint-methods";

export type PullRequestFilesResponse =
  RestEndpointMethodTypes["pulls"]["listFiles"]["response"];
export type PRFile = PullRequestFilesResponse["data"][number];

export type CreateReviewCommentParams =
  RestEndpointMethodTypes["pulls"]["createReviewComment"]["parameters"];
