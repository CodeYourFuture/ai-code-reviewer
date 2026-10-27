import { createHash } from "node:crypto";
import { z } from "zod";
import type { AuthConfig } from "./config.js";
import { userSchema, type LoginTransaction } from "./tokens.js";

export function authorizeUrl(
  config: AuthConfig,
  transaction: LoginTransaction,
) {
  const url = new URL("https://github.com/login/oauth/authorize");
  url.search = new URLSearchParams({
    client_id: config.GITHUB_APP_CLIENT_ID,
    redirect_uri: config.GITHUB_OAUTH_CALLBACK_URL,
    state: transaction.state,
    code_challenge: createHash("sha256")
      .update(transaction.verifier)
      .digest("base64url"),
    code_challenge_method: "S256",
  }).toString();
  return url.href;
}

export async function resolveGithubUser(
  config: AuthConfig,
  code: string,
  verifier: string,
  fetcher = fetch,
) {
  const tokenResponse = await fetcher(
    "https://github.com/login/oauth/access_token",
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: config.GITHUB_APP_CLIENT_ID,
        client_secret: config.GITHUB_APP_CLIENT_SECRET,
        redirect_uri: config.GITHUB_OAUTH_CALLBACK_URL,
        code,
        code_verifier: verifier,
      }),
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!tokenResponse.ok) throw new Error("GitHub token exchange failed");
  const token = z
    .object({ access_token: z.string().min(1), error: z.never().optional() })
    .parse(await tokenResponse.json());
  const userResponse = await fetcher("https://api.github.com/user", {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token.access_token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!userResponse.ok) throw new Error("GitHub profile request failed");
  // User/refresh tokens are never persisted or sent to the browser.
  return userSchema.parse(await userResponse.json());
}
