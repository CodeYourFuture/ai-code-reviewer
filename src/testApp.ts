import { App } from "octokit";
import { env, privateKey } from "./config/env.ts";

// I have to manually point to the repo on which PRs app should comment
const owner = "Droid-An";
const repo = "Module-Data-Flows";
const app = new App({
  appId: env.APP_ID,
  privateKey: privateKey,
});

const installation = await app.octokit.request(
  "GET /repos/{owner}/{repo}/installation",
  {
    owner,
    repo,
    headers: {
      "X-GitHub-Api-Version": "2022-11-28",
    },
  },
);

const octokit = await app.getInstallationOctokit(installation.data.id);

export { octokit };
