import { RequestError } from "@octokit/request-error";
import type { EmitterWebhookEvent } from "@octokit/webhooks";
import { Octokit } from "octokit";
import { runAiReview } from "./networks/ai_api_request.ts";
import { getPRFiles, logPRFiles } from "./networks/github.ts";
import { postInlineComments } from "./networks/postInlineComment.ts";
import { postPRComment } from "./networks/postPrComment.ts";

const messageForNewPRs =
  "Thanks for opening a new PR! Please follow our contributing guidelines to make your PR easier to review.";

export async function handleLabeled(
  event: EmitterWebhookEvent<"pull_request.labeled"> & { octokit: Octokit },
) {
  const { payload, octokit } = event;
  const label = payload.label?.name;
  console.log(
    `Received a "labeled" event for PR #${payload.pull_request.number}`,
  );
  if (label === "needs review") {
    try {
      const owner = payload.repository.owner.login;
      const repo = payload.repository.name;
      const pullNumber = payload.pull_request.number;
      const commitId = payload.pull_request.head.sha;

      postPRComment({
        owner,
        repo,
        pullNumber,
        body: messageForNewPRs,
        octokit,
      });
      const files = await getPRFiles(owner, repo, pullNumber, octokit);
      await logPRFiles(owner, repo, pullNumber, files);
      const aiReview = await runAiReview(files);

      for (const point of aiReview.feedback_points) {
        postInlineComments(owner, repo, pullNumber, octokit, point, commitId);
      }
    } catch (error) {
      if (error instanceof RequestError) {
        if (error.response) {
          console.error(
            `Error! Status: ${error.response.status}. Message: ${error.response.data}`,
          );
        }
        console.error(error);
      }
    }
  }
}
