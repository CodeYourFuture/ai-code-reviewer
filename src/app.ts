import { RequestError } from "@octokit/request-error";
import type { EmitterWebhookEvent } from "@octokit/webhooks";
import { createNodeMiddleware } from "@octokit/webhooks";
import express from "express";
import { App, Octokit } from "octokit";
import { env, privateKey } from "./config/env.ts";
import { runAiReview } from "./networks/ai_api_request.ts";
import { getPRFiles, logPRFiles } from "./networks/github.ts";
import { postInlineComments } from "./networks/postInlineComment.ts";
import { postPRComment } from "./networks/postPrComment.ts";

const app = new App({
  appId: env.APP_ID,
  privateKey: privateKey,
  webhooks: {
    secret: env.WEBHOOK_SECRET,
  },
});

const path = "/api/webhook";

const middleware = createNodeMiddleware(app.webhooks, { path });

const server = express();
server.use(middleware);
server.use(express.json());

const messageForNewPRs =
  "Thanks for opening a new PR! Please follow our contributing guidelines to make your PR easier to review.";

async function handlePullRequestOpened(
  event: EmitterWebhookEvent<"pull_request.opened"> & { octokit: Octokit },
) {
  const { payload, octokit } = event;
  console.log(
    `Received a pull request event for #${payload.pull_request.number}`,
  );

  try {
    const owner = payload.repository.owner.login;
    const repo = payload.repository.name;
    const pullNumber = payload.pull_request.number;
    const commitId = payload.pull_request.head.sha;

    postPRComment({ owner, repo, pullNumber, body: messageForNewPRs, octokit });
    const files = await getPRFiles(owner, repo, pullNumber, octokit);
    await logPRFiles(owner, repo, pullNumber, files);
    const aiReview = await runAiReview(files);

    // await postPRComment({
    //   owner,
    //   repo,
    //   pullNumber,
    //   body: `## 🤖 AI PR Review\n\n${aiReview}`,
    //   octokit,
    // });

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

app.webhooks.on("pull_request.opened", handlePullRequestOpened);

app.webhooks.onError((error) => {
  if (error.name === "AggregateError") {
    console.error(`Error processing request: ${error.event}`);
  } else {
    console.error(error);
  }
});

server.listen(env.PORT, () => {
  console.log(`Server running on port ${env.PORT}`);
});
