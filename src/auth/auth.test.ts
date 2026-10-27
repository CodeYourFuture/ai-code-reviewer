import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { once } from "node:events";
import type { Server } from "node:http";
import { createHash } from "node:crypto";
import { SignJWT } from "jose";
import { createApp } from "../app.js";
import { authSchema, type AuthConfig } from "./config.js";
import { createTokens } from "./tokens.js";

const config: AuthConfig = {
  NODE_ENV: "production",
  GITHUB_APP_CLIENT_ID: "Iv1.test",
  GITHUB_APP_CLIENT_SECRET: "test-client-secret",
  GITHUB_OAUTH_CALLBACK_URL:
    "https://ai-code-reviewer.hosted.codeyourfuture.io/api/auth/callback",
  FRONTEND_BASE_URL:
    "https://ai-code-reviewer-feedback.hosted.codeyourfuture.io",
  SESSION_SECRET_KEY: "a-test-only-secret-with-at-least-32-characters",
  SESSION_EXPIRE_HOURS: 24,
};
const tokens = createTokens(config);
const user = { id: 12345, login: "alice" };
let server: Server;
let base: string;
let isAllowed: ReturnType<typeof vi.fn>;
let fetcher: ReturnType<typeof vi.fn>;
let fetchFeedback: ReturnType<typeof vi.fn>;
let rateFeedback: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  isAllowed = vi.fn().mockResolvedValue(true);
  fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json({
        access_token: "secret-github-token",
        refresh_token: "secret-refresh-token",
      }),
    )
    .mockResolvedValueOnce(
      Response.json({ ...user, email: "unused@example.com" }),
    );
  fetchFeedback = vi.fn().mockResolvedValue([]);
  rateFeedback = vi.fn().mockResolvedValue(1);
  const app = createApp({
    config,
    isAllowed,
    fetcher,
    fetchFeedback,
    rateFeedback,
    webhook: (req, res, next) => {
      if (req.path === "/api/webhook") {
        res.sendStatus(202);
        return;
      }
      next();
    },
  });
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing test server address");
  base = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  server?.closeAllConnections();
  if (server)
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
});

const request = (path: string, options: RequestInit = {}) =>
  fetch(`${base}${path}`, { redirect: "manual", ...options });
const cookieValue = (response: Response, name: string) =>
  response.headers
    .getSetCookie()
    .find((value) => value.startsWith(`${name}=`))!
    .split(";")[0];

async function startLogin() {
  const response = await request("/api/auth/login?id=42");
  const location = new URL(response.headers.get("location")!);
  return {
    response,
    location,
    cookie: cookieValue(response, "__Host-github-login"),
  };
}

async function signedIn() {
  const token = await tokens.signSession(user);
  const session = await tokens.readSession(token);
  return { cookie: `__Host-session=${token}`, csrf: session.csrfToken };
}

describe("GitHub login and feedback sessions", () => {
  it("completes PKCE login, preserves the feedback ID, and uses a fixed secure host-only session", async () => {
    const login = await startLogin();
    expect(login.location.origin).toBe("https://github.com");
    expect(login.location.searchParams.get("client_id")).toBe(
      config.GITHUB_APP_CLIENT_ID,
    );
    expect(login.location.searchParams.get("redirect_uri")).toBe(
      config.GITHUB_OAUTH_CALLBACK_URL,
    );
    expect(login.location.searchParams.has("scope")).toBe(false);
    expect(login.location.searchParams.get("code_challenge_method")).toBe(
      "S256",
    );
    const response = await request(
      `/api/auth/callback?code=github-code&state=${login.location.searchParams.get("state")}`,
      { headers: { Cookie: login.cookie } },
    );
    expect(response.headers.get("location")).toBe(
      `${config.FRONTEND_BASE_URL}/?id=42`,
    );
    const transaction = await tokens.readTransaction(
      login.cookie.split("=")[1],
    );
    expect(login.location.searchParams.get("code_challenge")).toBe(
      createHash("sha256").update(transaction.verifier).digest("base64url"),
    );
    const exchange = fetcher.mock.calls[0][1];
    expect(exchange.body.get("code_verifier")).toBe(transaction.verifier);
    expect(exchange.body.get("client_secret")).toBe(
      config.GITHUB_APP_CLIENT_SECRET,
    );
    expect(fetcher.mock.calls[1][1].headers.Authorization).toBe(
      "Bearer secret-github-token",
    );
    expect(isAllowed).toHaveBeenCalledWith("alice");
    const sessionCookie = response.headers
      .getSetCookie()
      .find((value) => value.startsWith("__Host-session="))!;
    expect(sessionCookie).toContain("Max-Age=86400");
    expect(sessionCookie).toContain("HttpOnly");
    expect(sessionCookie).toContain("Secure");
    expect(sessionCookie).toContain("SameSite=Lax");
    expect(sessionCookie).toContain("Path=/");
    expect(sessionCookie).not.toContain("Domain=");
    expect(
      response.headers
        .getSetCookie()
        .some(
          (value) =>
            value.startsWith("__Host-github-login=;") && value.includes("1970"),
        ),
    ).toBe(true);
    const me = await request("/api/auth/me", {
      headers: {
        Cookie: sessionCookie.split(";")[0],
        Origin: config.FRONTEND_BASE_URL,
      },
    });
    expect(me.headers.get("access-control-allow-origin")).toBe(
      config.FRONTEND_BASE_URL,
    );
    expect(me.headers.get("access-control-allow-credentials")).toBe("true");
    expect(me.headers.get("cache-control")).toBe("no-store");
    expect(me.headers.has("set-cookie")).toBe(false); // Requests never renew the fixed expiry.
    const data = await me.json();
    expect(data.user).toEqual(user);
    expect(data.csrfToken).toHaveLength(43);
    expect(JSON.stringify(data)).not.toContain("secret-github-token");
  });

  it.each([undefined, "wrong-state"])(
    "rejects missing or mismatched state before calling GitHub: %s",
    async (state) => {
      const login = await startLogin();
      const response = await request(
        `/api/auth/callback?code=test${state ? `&state=${state}` : ""}`,
        { headers: { Cookie: login.cookie } },
      );
      const location = new URL(response.headers.get("location")!);
      expect(location.searchParams.get("id")).toBe("42");
      expect(location.searchParams.get("error")).toContain(
        "Invalid login state",
      );
      expect(fetcher).not.toHaveBeenCalled();
      expect(response.headers.getSetCookie().join()).not.toContain(
        "__Host-session=",
      );
    },
  );

  it("rejects callbacks without the browser cookie and ignores arbitrary return destinations", async () => {
    const response = await request(
      "/api/auth/callback?code=test&state=test&returnTo=https://evil.example",
    );
    expect(new URL(response.headers.get("location")!).origin).toBe(
      config.FRONTEND_BASE_URL,
    );
    expect(fetcher).not.toHaveBeenCalled();
    expect(
      (await request("/api/auth/login?id=https://evil.example")).status,
    ).toBe(400);
  });

  it.each(["cancel", "exchange", "profile", "denied", "membership-outage"])(
    "handles %s safely and retains the comment ID",
    async (failure) => {
      const login = await startLogin();
      if (failure === "exchange")
        fetcher
          .mockReset()
          .mockResolvedValue(
            Response.json({
              error: "bad_verification_code",
              error_description: "secret-details",
            }),
          );
      if (failure === "profile")
        fetcher
          .mockReset()
          .mockResolvedValueOnce(Response.json({ access_token: "secret" }))
          .mockResolvedValueOnce(new Response(null, { status: 503 }));
      if (failure === "denied") isAllowed.mockResolvedValue(false);
      if (failure === "membership-outage")
        isAllowed.mockRejectedValue(new Error("secret-details"));
      const query =
        failure === "cancel"
          ? "error=access_denied&error_description=secret-details"
          : "code=test";
      const response = await request(
        `/api/auth/callback?${query}&state=${login.location.searchParams.get("state")}`,
        { headers: { Cookie: login.cookie } },
      );
      const location = new URL(response.headers.get("location")!);
      expect(location.searchParams.get("id")).toBe("42");
      expect(location.searchParams.has("error")).toBe(true);
      expect(location.href).not.toContain("secret");
      expect(response.headers.getSetCookie().join()).not.toContain(
        "__Host-session=",
      );
    },
  );

  it("rejects expired login transactions", async () => {
    const token = await new SignJWT({
      state: "s".repeat(43),
      verifier: "v".repeat(43),
      commentId: "42",
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuer(new URL(config.GITHUB_OAUTH_CALLBACK_URL).origin)
      .setAudience("github-login")
      .setIssuedAt(1)
      .setExpirationTime(2)
      .sign(new TextEncoder().encode(config.SESSION_SECRET_KEY));
    const response = await request("/api/auth/callback?state=test&code=test", {
      headers: { Cookie: `__Host-github-login=${token}` },
    });
    expect(
      new URL(response.headers.get("location")!).searchParams.get("error"),
    ).toContain("expired");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("denies unauthenticated requests even with an old bearer token", async () => {
    for (const path of [
      "/api/auth/me",
      "/hasUserRatedComment/42",
      "/reaction/42",
    ]) {
      const response = await request(path, {
        method: path.startsWith("/reaction") ? "POST" : "GET",
        headers: { Authorization: "Bearer former-provider-token" },
      });
      expect(response.status).toBe(401);
    }
    expect(fetchFeedback).not.toHaveBeenCalled();
  });

  it("checks authorization on each request and distinguishes denial from outages", async () => {
    const session = await signedIn();
    for (const path of [
      "/api/auth/me",
      "/hasUserRatedComment/42",
      "/reaction/42",
    ]) {
      const options = {
        method: path.startsWith("/reaction") ? "POST" : "GET",
        headers: {
          Cookie: session.cookie,
          Origin: config.FRONTEND_BASE_URL,
          "X-CSRF-Token": session.csrf,
        },
      };
      isAllowed.mockResolvedValue(false);
      expect((await request(path, options)).status).toBe(403);
      isAllowed.mockRejectedValue(new Error("unavailable"));
      expect((await request(path, options)).status).toBe(502);
    }
    expect(fetchFeedback).not.toHaveBeenCalled();
  });

  it.each([
    { Origin: "https://evil.example" },
    { Origin: "https://other.hosted.codeyourfuture.io" },
    { Origin: config.FRONTEND_BASE_URL },
    { "X-CSRF-Token": "wrong" },
  ])(
    "blocks mutations with invalid origin or CSRF token: %j",
    async (headers) => {
      const session = await signedIn();
      for (const path of ["/reaction/42", "/api/auth/logout"]) {
        const response = await request(path, {
          method: "POST",
          headers: { Cookie: session.cookie, ...headers },
        });
        expect(response.status).toBe(403);
      }
      expect(rateFeedback).not.toHaveBeenCalled();
    },
  );

  it("submits ratings with the verified GitHub identity and recognizes historical ratings", async () => {
    const session = await signedIn();
    const headers = {
      Cookie: session.cookie,
      Origin: config.FRONTEND_BASE_URL,
      "X-CSRF-Token": session.csrf,
      "Content-Type": "application/json",
    };
    expect(
      (
        await request("/reaction/42", {
          method: "POST",
          headers,
          body: JSON.stringify({
            reaction: "like",
            userId: 999,
            nickname: "imposter",
          }),
        })
      ).status,
    ).toBe(200);
    expect(rateFeedback).toHaveBeenCalledWith(42, "like", user.id, user.login);
    fetchFeedback.mockResolvedValue([
      { user_github_id: user.id, ai_review_id: 42 },
    ]);
    const previous = await request("/hasUserRatedComment/42", { headers });
    expect(await previous.json()).toEqual({ message: true });
    expect(fetchFeedback).toHaveBeenLastCalledWith(user.id, 42);
    expect(
      (
        await request("/reaction/42", {
          method: "POST",
          headers,
          body: JSON.stringify({ reaction: "dislike" }),
        })
      ).status,
    ).toBe(409);
    expect(rateFeedback).toHaveBeenCalledTimes(1);
    expect(
      (
        await request("/reaction/42", {
          method: "POST",
          headers,
          body: JSON.stringify({ reaction: "bad" }),
        })
      ).status,
    ).toBe(400);
  });

  it("logs out with matching cookie attributes even after access is removed", async () => {
    const session = await signedIn();
    isAllowed.mockResolvedValue(false);
    const response = await request("/api/auth/logout", {
      method: "POST",
      headers: {
        Cookie: session.cookie,
        Origin: config.FRONTEND_BASE_URL,
        "X-CSRF-Token": session.csrf,
      },
    });
    expect(response.status).toBe(204);
    expect(response.headers.getSetCookie().join()).toContain(
      "__Host-session=; Path=/; Expires=Thu, 01 Jan 1970",
    );
    expect(response.headers.getSetCookie().join()).toContain(
      "Secure; SameSite=Lax",
    );
    expect((await request("/api/auth/me")).status).toBe(401);
  });

  it("supports CORS preflights for the configured frontend", async () => {
    const response = await request("/reaction/42", {
      method: "OPTIONS",
      headers: {
        Origin: config.FRONTEND_BASE_URL,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type,x-csrf-token",
      },
    });
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      config.FRONTEND_BASE_URL,
    );
    expect(response.headers.get("access-control-allow-headers")).toContain(
      "X-CSRF-Token",
    );
    const other = await request("/api/auth/me", {
      headers: { Origin: "https://evil.example" },
    });
    expect(other.headers.get("access-control-allow-origin")).not.toBe(
      "https://evil.example",
    );
  });

  it("keeps health and webhooks independent of browser sessions", async () => {
    expect((await request("/health")).status).toBe(200);
    expect((await request("/api/webhook", { method: "POST" })).status).toBe(
      202,
    );
    expect(isAllowed).not.toHaveBeenCalled();
  });
});

describe("token and configuration validation", () => {
  it("rejects tampering, expired tokens, wrong issuers/audiences, and invalid identity claims", async () => {
    const valid = await tokens.signSession(user);
    const parts = valid.split(".");
    parts[1] = Buffer.from(
      JSON.stringify({ id: 999, login: "imposter" }),
    ).toString("base64url");
    await expect(tokens.readSession(parts.join("."))).rejects.toThrow();
    const transaction = await tokens.signTransaction({
      state: "s".repeat(43),
      verifier: "v".repeat(43),
      commentId: "42",
    });
    await expect(tokens.readSession(transaction)).rejects.toThrow();
    for (const overrides of [
      { exp: 1 },
      { iss: "https://evil.example" },
      { aud: "other" },
      { id: -1 },
      { sub: "999" },
      { csrfToken: "" },
      { exp: undefined },
    ]) {
      const token = await new SignJWT({
        id: user.id,
        login: user.login,
        sub: String(user.id),
        csrfToken: "s".repeat(43),
        iss: new URL(config.GITHUB_OAUTH_CALLBACK_URL).origin,
        aud: "feedback-session",
        iat: 1,
        exp: Math.floor(Date.now() / 1000) + 3600,
        ...overrides,
      })
        .setProtectedHeader({ alg: "HS256", typ: "JWT" })
        .sign(new TextEncoder().encode(config.SESSION_SECRET_KEY));
      await expect(tokens.readSession(token)).rejects.toThrow();
      expect(
        (
          await request("/api/auth/me", {
            headers: { Cookie: `__Host-session=${token}` },
          })
        ).status,
      ).toBe(401);
    }
  });

  it("requires strong secrets and valid callback/frontend settings and defaults to 24 hours", () => {
    expect(
      authSchema.parse({ ...config, SESSION_EXPIRE_HOURS: undefined })
        .SESSION_EXPIRE_HOURS,
    ).toBe(24);
    for (const overrides of [
      { SESSION_SECRET_KEY: "short" },
      { SESSION_EXPIRE_HOURS: 0 },
      { SESSION_EXPIRE_HOURS: "no" },
      { GITHUB_OAUTH_CALLBACK_URL: "bad-url" },
      { GITHUB_OAUTH_CALLBACK_URL: "https://backend.example/wrong" },
      { FRONTEND_BASE_URL: "https://frontend.example/path" },
    ]) {
      expect(authSchema.safeParse({ ...config, ...overrides }).success).toBe(
        false,
      );
    }
  });
});
