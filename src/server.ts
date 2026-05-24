import { createNodeMiddleware } from "@octokit/webhooks";
import express from "express";
import { env } from "./config/env.js";
import { githubApp } from "./githubApp.js";
import { rateFeedback } from "./sendRate.js";
import cors from "cors";
import { fetchFeedbackFromUser } from "./fetchUserFedback.js";
import {
  auth,
  InvalidTokenError,
  UnauthorizedError,
} from "express-oauth2-jwt-bearer";
import { Request, Response, NextFunction } from "express";

const path = "/api/webhook";

const middleware = createNodeMiddleware(githubApp.webhooks, { path });

const server = express();
server.use(cors());
server.use(middleware);
server.use(express.json());

// Configure JWT validation middleware
const checkJwt = auth({
  audience: env.AUTH0_AUDIENCE,
  issuerBaseURL: `https://${env.AUTH0_DOMAIN}`,
});

server.get("/health", (_, res) => {
  res.json({ status: "ok", message: "Server is healthy" });
});

server.post("/reaction/:id", checkJwt, async (req, res) => {
  const { id } = req.params;
  if (!id || isNaN(Number(id))) {
    return res.status(400).json({ message: "Invalid or missing id" });
  }
  try {
    const existingFeedback = await fetchFeedbackFromUser(
      req.body.userId,
      Number(id),
    );
    if (existingFeedback.length > 0) {
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

server.get("/hasUserRatedComment/:id", checkJwt, async (req, res) => {
  const { id } = req.params;
  if (!id || isNaN(Number(id))) {
    return res.status(400).json({ message: "Invalid or missing id" });
  }
  const existingFeedback = await fetchFeedbackFromUser(
    Number(req.auth?.payload?.sub?.split("|")[1]),
    Number(id),
  );

  res.status(200).json({ message: Object.keys(existingFeedback).length > 0 });
});

server.use(
  (
    error: Error,
    _request: Request,
    response: Response,
    _next: NextFunction,
  ) => {
    console.error(error.stack);
    if (error instanceof InvalidTokenError) {
      const message = "Bad credentials";

      response.status(error.status).json({ message });

      return;
    }

    if (error instanceof UnauthorizedError) {
      const message = "Requires authentication";

      response.status(error.status).json({ message });

      return;
    }

    const status = 500;
    const message = "Internal Server Error";

    response.status(status).json({ message });
  },
);
server.listen(env.PORT, () => {
  console.log(`Server running on port ${env.PORT}`);
});
