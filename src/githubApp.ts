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

// Development authorization uses the allowlist and needs no organization client.
export const orgOctokit = await (async () => {
  if (env.NODE_ENV !== "production") return undefined;

  const installationOrg = await githubApp.octokit.request(
    "GET /orgs/{org}/installation",
    {
      org: env.GITHUB_MEMBERSHIP_ORG,
      headers: {
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );
  return githubApp.getInstallationOctokit(installationOrg.data.id);
})();
