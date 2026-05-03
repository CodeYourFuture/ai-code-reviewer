import { createNodeMiddleware } from "@octokit/webhooks";
import express from "express";
import { env } from "./config/env.js";
import { githubApp } from "./githubApp.js";
import { rateFeedback } from "./sendRate.js";
import cors from "cors";
const path = "/api/webhook";

const middleware = createNodeMiddleware(githubApp.webhooks, { path });

const server = express();
server.use(middleware);
server.use(express.json());
server.use(cors());

server.listen(env.PORT, () => {
  console.log(`Server running on port ${env.PORT}`);
});

server.get("/health", (_, res) => {
  res.json({ status: "ok", message: "Server is healthy" });
});

server.get("/like/:id", (req, res) => {
  const { id } = req.params;
  rateFeedback(Number(id), "like");
  res.json({ message: `sent your like to the post with id ${id}` });
});
server.get("/dislike/:id", (req, res) => {
  const { id } = req.params;
  rateFeedback(Number(id), "dislike");
  res.json({ message: `sent your dislike to the post with id ${id}` });
});
