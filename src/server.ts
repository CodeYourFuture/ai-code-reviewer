import { createNodeMiddleware } from "@octokit/webhooks";
import { env } from "./config/env.js";
import { githubApp, orgOctokit } from "./githubApp.js";
import { isGithubUserAllowed } from "./config/access.js";
import { checkMembershipForUser } from "./networks/githubApi/checkMembershipForUser.js";
import { rateFeedback } from "./db/sendRate.js";
import { fetchFeedbackFromUser } from "./db/fetchUserFeedback.js";
import { assertDbConnection } from "./db/db.js";
import { createApp } from "./app.js";

const server = createApp({
  config: env,
  isAllowed: (login) =>
    isGithubUserAllowed(login, env, async () => {
      if (!orgOctokit) throw new Error("Organization client is unavailable");
      return checkMembershipForUser(
        login,
        orgOctokit,
        env.GITHUB_MEMBERSHIP_ORG,
      );
    }),
  webhook: createNodeMiddleware(githubApp.webhooks, { path: "/api/webhook" }),
  fetchFeedback: fetchFeedbackFromUser,
  rateFeedback,
});

try {
  await assertDbConnection();
  server.listen(env.PORT, () => {
    console.log(`Server running on port ${env.PORT}`);
    console.log(
      "Reviewer configuration:",
      JSON.stringify({
        AI_MODEL: env.AI_MODEL,
        AI_REASONING_EFFORT: env.AI_REASONING_EFFORT,
        AI_MAX_COMPLETION_TOKENS: env.AI_MAX_COMPLETION_TOKENS,
        MULTIPLE_REVIEWS_ALLOWED: env.MULTIPLE_REVIEWS_ALLOWED,
      }),
    );
  });
} catch (err) {
  console.error("Could not connect to PostgreSQL, aborting startup:", err);
  process.exit(1);
}
