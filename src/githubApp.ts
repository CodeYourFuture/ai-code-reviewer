import { App } from "octokit";
import { env, privateKey } from "./config/env";
import { handleLabeled } from "./handleLabeled";

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
