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

server.get("/health", (_, res) => {
  res.json({ status: "ok", message: "Server is healthy" });
});

server.get("/like/:id", (req, res) => {
  const { id } = req.params;
  console.log(id);
  res.json({ message: `sent your like to the post with id ${id}` });
});
