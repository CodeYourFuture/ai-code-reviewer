import { createNodeMiddleware } from "@octokit/webhooks";
import express from "express";
import { env } from "./config/env.js";
import { githubApp } from "./githubApp.js";
import { rateFeedback } from "./sendRate.js";
import cors from "cors";
import { fetchFeedbackFromUser } from "./fetchUserFedback.js";
const path = "/api/webhook";

const middleware = createNodeMiddleware(githubApp.webhooks, { path });

const server = express();
server.use(cors());
server.use(middleware);
server.use(express.json());

server.listen(env.PORT, () => {
  console.log(`Server running on port ${env.PORT}`);
});

server.get("/health", (_, res) => {
  res.json({ status: "ok", message: "Server is healthy" });
});

server.post("/reaction/:id", async (req, res) => {
  const { id } = req.params;
  if (!id || isNaN(Number(id))) {
    return res.status(400).json({ message: "Invalid or missing id" });
  }
  try {
    const existingFeedback = await fetchFeedbackFromUser(
      req.body.userId,
      Number(id),
    );
    if (existingFeedback) {
      throw new Error("You cannot add more than one feedback to a comment");
    }
    await rateFeedback(
      Number(id),
      req.body.reaction,
      req.body.userId,
      req.body.nickname,
    );
    res.json({
      message: `sent your ${req.body.reaction} to the post with id ${id}`,
    });
  } catch (error) {
    res.status(500).json({
      message: error instanceof Error ? error.message : "Internal server error",
    });
  }
});
