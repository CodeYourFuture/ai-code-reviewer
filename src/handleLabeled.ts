import { RequestError } from "@octokit/request-error";
import type { EmitterWebhookEvent } from "@octokit/webhooks";
import { Octokit } from "octokit";
import { checkMembershipForUser } from "./checkMembershipForUser.js";
import { runAiReview } from "./networks/ai/ai_api_request.js";
import { getPRFiles, logPRFiles } from "./networks/github.js";
import { postInlineComments } from "./networks/postInlineComment.js";
import { postPRComment } from "./networks/postPrComment.js";

const messageForNewPRs = "Thanks for opening a new PR! AI started to review it";
const messageWhenNoFeedback =
  "Your code is ready to be reviewed by a volunteer";

export async function handleLabeled(
  event: EmitterWebhookEvent<"pull_request.labeled"> & { octokit: Octokit },
) {
  const { payload, octokit } = event;
  if (!payload.pull_request) return;
  const label = payload.label?.name;
  console.log(
    `Received a "labeled" event for PR #${payload.pull_request.number}`,
  );

  if (process.env.NODE_ENV === 'production' && !(await checkMembershipForUser(payload.sender.login, octokit))) {
    console.log("sender isn't a member of cyf");
    return;
  }

  if (label?.toLocaleLowerCase() === "needs review") {
    try {
      const owner = payload.repository.owner.login;
      const repo = payload.repository.name;
      const pullNumber = payload.pull_request.number;
      const commitId = payload.pull_request.head.sha;

      await postPRComment({
        owner,
        repo,
        pullNumber,
        body: messageForNewPRs,
        octokit,
      });
      const files = await getPRFiles(owner, repo, pullNumber, octokit);
      await logPRFiles(owner, repo, pullNumber, files);
      const aiReview = await runAiReview(files);
      if (aiReview.some((response) => response.feedback_points.length > 0)) {
        await postInlineComments(
          owner,
          repo,
          pullNumber,
          octokit,
          aiReview,
          commitId,
        );
      } else {
        await postPRComment({
          owner,
          repo,
          pullNumber,
          body: messageWhenNoFeedback,
          octokit,
        });
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
  } else {
    console.log(`Received label "${label}" isn't "Needs Review"`);
  }
}
