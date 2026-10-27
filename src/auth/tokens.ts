import { randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";
import type { AuthConfig } from "./config.js";

export const userSchema = z.object({
  id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  login: z
    .string()
    .regex(/^[a-zA-Z0-9-]+$/)
    .max(39),
});
export type GithubUser = z.infer<typeof userSchema>;

const sessionSchema = userSchema.extend({ csrfToken: z.string().min(32) });
const transactionSchema = z.object({
  state: z.string().min(32),
  verifier: z.string().min(43),
  commentId: z.string().regex(/^[1-9]\d*$/),
});
export type LoginTransaction = z.infer<typeof transactionSchema>;
export const nonce = () => randomBytes(32).toString("base64url");

export function createTokens(config: AuthConfig) {
  const key = new TextEncoder().encode(config.SESSION_SECRET_KEY);
  const issuer = new URL(config.GITHUB_OAUTH_CALLBACK_URL).origin;

  async function sign(
    payload: Record<string, unknown>,
    audience: string,
    seconds: number,
  ) {
    return new SignJWT(payload)
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuer(issuer)
      .setAudience(audience)
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) + seconds)
      .sign(key);
  }

  async function verify(token: string, audience: string) {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ["HS256"],
      typ: "JWT",
      issuer,
      audience,
      requiredClaims: ["iat", "exp"],
    });
    return payload;
  }

  return {
    signSession: (user: GithubUser) =>
      sign(
        { ...user, sub: String(user.id), csrfToken: nonce() },
        "feedback-session",
        config.SESSION_EXPIRE_HOURS * 3600,
      ),
    async readSession(token: string) {
      const payload = await verify(token, "feedback-session");
      const session = sessionSchema.parse(payload);
      if (payload.sub !== String(session.id))
        throw new Error("Invalid session identity");
      return session;
    },
    signTransaction: (transaction: LoginTransaction) =>
      sign(transaction, "github-login", 300),
    readTransaction: async (token: string) =>
      transactionSchema.parse(await verify(token, "github-login")),
  };
}
