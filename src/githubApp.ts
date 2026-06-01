import { App } from "octokit";
import { env, privateKey } from "./config/env.js";
import { handleLabeled } from "./handleLabeled.js";

export const githubApp = new App({
  appId: env.APP_ID,
  privateKey,
  webhooks: {
    secret: env.WEBHOOK_SECRET,
  },
});

githubApp.webhooks.on("pull_request.labeled", handleLabeled);

githubApp.webhooks.onError((error) => {
  if (error.name === "AggregateError") {
    console.error(`Error processing request: ${error.event}`);
  } else {
    console.error(error);
  }
});

const installationOrg = await githubApp.octokit.request(
  "GET /orgs/CodeYourFuture/installation",
  {
    headers: {
      "X-GitHub-Api-Version": "2022-11-28",
    },
  },
);
// orgOctokit is an octokit instance that can request github api on behalf of the app installed on the CodeYourFuture repo
export const orgOctokit = await githubApp.getInstallationOctokit(
  installationOrg.data.id,
);
