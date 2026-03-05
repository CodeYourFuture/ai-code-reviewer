import { createNodeMiddleware } from "@octokit/webhooks";
import express from "express";
import { env } from "./config/env.js";
import { githubApp } from "./githubApp.js";

const path = "/api/webhook";

const middleware = createNodeMiddleware(githubApp.webhooks, { path });

const server = express();
server.use(middleware);
server.use(express.json());

server.listen(env.PORT, () => {
  console.log(`Server running on port ${env.PORT}`);
});
