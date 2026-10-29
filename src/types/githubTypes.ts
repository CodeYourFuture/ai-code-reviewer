import type { RestEndpointMethodTypes } from "@octokit/plugin-rest-endpoint-methods";

export type TimelineEventsData =
  RestEndpointMethodTypes["issues"]["listEventsForTimeline"]["response"]["data"];

export type PullRequestFilesResponse =
  RestEndpointMethodTypes["pulls"]["listFiles"]["response"];

export type PRFile = PullRequestFilesResponse["data"][number];

export type PRFileWithContent = PRFile & {
  /** Full UTF-8 text at the PR head, when GitHub can return it. */
  fullContent?: string;
  /** Why full-file context was intentionally not included in the LLM input. */
  fullContentOmittedReason?: string;
};

//type for single comments on diff
export type CreateReviewCommentParams =
  RestEndpointMethodTypes["pulls"]["createReviewComment"]["parameters"];

export type CreateReviewForPR =
  RestEndpointMethodTypes["pulls"]["createReview"]["parameters"];

//type for one element from array of comments to include in one pr review
export type CreateReviewComment = NonNullable<
  CreateReviewForPR["comments"]
>[number];
