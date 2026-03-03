import { createNodeMiddleware } from "@octokit/webhooks";
import express from "express";
import { App } from "octokit";
import { env, privateKey } from "./config/env.ts";
import { handleLabeled } from "./handleLabeled.ts";

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

app.webhooks.on("pull_request.labeled", handleLabeled);

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
