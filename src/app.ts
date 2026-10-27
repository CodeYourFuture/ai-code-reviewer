import express, {
  type RequestHandler,
  type ErrorRequestHandler,
} from "express";
import cors from "cors";
import { createAuth } from "./auth/index.js";
import type { AuthConfig } from "./auth/config.js";

interface AppDependencies {
  config: AuthConfig;
  isAllowed: (login: string) => Promise<boolean>;
  webhook: RequestHandler;
  fetchFeedback: (userId: number, commentId: number) => Promise<unknown[]>;
  rateFeedback: (
    id: number,
    reaction: "like" | "dislike",
    userId: number,
    login: string,
  ) => Promise<unknown>;
  fetcher?: typeof fetch;
}

export function createApp(deps: AppDependencies) {
  const server = express();
  const auth = createAuth(deps.config, deps.isAllowed, deps.fetcher);
  // Webhooks keep their signature verification and raw body, independently of browser auth.
  server.use(deps.webhook);
  server.use(cors(auth.corsOptions));
  server.use(express.json());
  server.use("/api/auth", auth.router);
  server.get("/health", (_req, res) => {
    res.json({ status: "ok", message: "Server is healthy" });
  });

  server.post(
    "/reaction/:id",
    auth.requireSession,
    auth.requireCsrf,
    auth.requireAllowedUser,
    async (req, res) => {
      const id = Number(req.params.id);
      if (!Number.isSafeInteger(id) || id <= 0) {
        res.status(400).json({ message: "Invalid or missing id" });
        return;
      }
      const reaction = req.body?.reaction;
      if (reaction !== "like" && reaction !== "dislike") {
        res.status(400).json({ message: "Reaction must be like or dislike" });
        return;
      }
      const user = req.user!;
      try {
        if ((await deps.fetchFeedback(user.id, id)).length > 0) {
          res
            .status(409)
            .json({
              message: "You cannot add more than one feedback to a comment",
            });
          return;
        }
        await deps.rateFeedback(id, reaction, user.id, user.login);
        res.json({
          message: `sent your ${reaction} to the post with id ${id}`,
        });
      } catch (error) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "23503"
        ) {
          res.status(404).json({ message: "Requested resource doesn't exist" });
          return;
        }
        res
          .status(500)
          .json({ message: "Could not submit feedback. Please try again." });
      }
    },
  );

  server.get(
    "/hasUserRatedComment/:id",
    auth.requireSession,
    auth.requireAllowedUser,
    async (req, res) => {
      const id = Number(req.params.id);
      if (!Number.isSafeInteger(id) || id <= 0) {
        res.status(400).json({ message: "Invalid or missing id" });
        return;
      }
      const feedback = await deps.fetchFeedback(req.user!.id, id);
      res.json({ message: feedback.length > 0 });
    },
  );

  const handleError: ErrorRequestHandler = (_error, _req, res, _next) => {
    res.status(500).json({ message: "Internal Server Error" });
  };
  server.use(handleError);
  return server;
}
