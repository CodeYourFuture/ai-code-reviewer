import { timingSafeEqual } from "node:crypto";
import {
  Router,
  type Request,
  type RequestHandler,
  type CookieOptions,
} from "express";
import type { CorsOptions } from "cors";
import type { AuthConfig } from "./config.js";
import { authorizeUrl, resolveGithubUser } from "./github.js";
import {
  createTokens,
  nonce,
  type GithubUser,
  type LoginTransaction,
} from "./tokens.js";

declare global {
  namespace Express {
    interface Request {
      user?: GithubUser;
      csrfToken?: string;
    }
  }
}

function sameValue(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function cookie(req: Request, name: string) {
  const values = (req.headers.cookie ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${name}=`));
  // Reject ambiguous cookies, including duplicate names with different paths.
  if (values.length !== 1) return "";
  try {
    return decodeURIComponent(values[0].slice(name.length + 1));
  } catch {
    return "";
  }
}

export function createAuth(
  config: AuthConfig,
  isAllowed: (login: string) => Promise<boolean>,
  fetcher = fetch,
) {
  const production = config.NODE_ENV === "production";
  const frontendOrigin = new URL(config.FRONTEND_BASE_URL).origin;
  const sessionCookie = production ? "__Host-session" : "reviewer-session";
  const loginCookie = production
    ? "__Host-github-login"
    : "reviewer-github-login";
  const cookieOptions: CookieOptions = {
    httpOnly: true,
    secure: production,
    sameSite: "lax",
    path: "/",
  };
  const tokens = createTokens(config);
  const router = Router();
  router.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });

  const corsOptions: CorsOptions = {
    origin: frontendOrigin,
    credentials: true,
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "X-CSRF-Token"],
  };

  function feedbackUrl(commentId?: string, error?: string) {
    const url = new URL("/", frontendOrigin);
    if (commentId) url.searchParams.set("id", commentId);
    if (error) url.searchParams.set("error", error);
    return url.href;
  }

  const requireSession: RequestHandler = async (req, res, next) => {
    res.set("Cache-Control", "no-store");
    try {
      const session = await tokens.readSession(cookie(req, sessionCookie));
      req.user = { id: session.id, login: session.login };
      req.csrfToken = session.csrfToken;
    } catch {
      res.clearCookie(sessionCookie, cookieOptions);
      res
        .status(401)
        .json({
          message: "Your session has expired. Please sign in with GitHub.",
        });
      return;
    }
    next();
  };

  const requireAllowedUser: RequestHandler = async (req, res, next) => {
    try {
      if (req.user && (await isAllowed(req.user.login))) {
        next();
        return;
      }
      res.status(403).json({ message: "GitHub user is not authorized" });
    } catch {
      res
        .status(502)
        .json({ message: "Membership check failed. Please try again." });
    }
  };

  const requireCsrf: RequestHandler = (req, res, next) => {
    if (
      req.get("Origin") !== frontendOrigin ||
      !req.csrfToken ||
      !sameValue(req.get("X-CSRF-Token") ?? "", req.csrfToken)
    ) {
      res
        .status(403)
        .json({
          message:
            "Invalid request origin or CSRF token. Please reload the page.",
        });
      return;
    }
    next();
  };

  router.get("/login", async (req, res) => {
    const commentId = req.query.id;
    if (
      typeof commentId !== "string" ||
      !/^[1-9]\d*$/.test(commentId) ||
      !Number.isSafeInteger(Number(commentId))
    ) {
      res.status(400).json({ message: "Invalid or missing comment ID" });
      return;
    }
    const transaction = { state: nonce(), verifier: nonce(), commentId };
    res.cookie(loginCookie, await tokens.signTransaction(transaction), {
      ...cookieOptions,
      maxAge: 300000,
    });
    res.redirect(authorizeUrl(config, transaction));
  });

  router.get("/callback", async (req, res) => {
    res.set("Referrer-Policy", "no-referrer");
    res.clearCookie(loginCookie, cookieOptions);
    let transaction: LoginTransaction;
    try {
      transaction = await tokens.readTransaction(cookie(req, loginCookie));
    } catch {
      res.redirect(
        feedbackUrl(
          undefined,
          "Login expired or invalid. Please reopen your feedback link.",
        ),
      );
      return;
    }
    if (
      typeof req.query.state !== "string" ||
      !sameValue(req.query.state, transaction.state)
    ) {
      res.redirect(
        feedbackUrl(
          transaction.commentId,
          "Invalid login state. Please sign in again.",
        ),
      );
      return;
    }
    if (
      req.query.error ||
      typeof req.query.code !== "string" ||
      !req.query.code
    ) {
      res.redirect(
        feedbackUrl(
          transaction.commentId,
          "GitHub sign-in was cancelled or failed. Please try again.",
        ),
      );
      return;
    }
    let user: GithubUser;
    try {
      user = await resolveGithubUser(
        config,
        req.query.code,
        transaction.verifier,
        fetcher,
      );
    } catch {
      res.redirect(
        feedbackUrl(
          transaction.commentId,
          "GitHub authentication failed. Please try again.",
        ),
      );
      return;
    }
    try {
      if (!(await isAllowed(user.login))) {
        res.redirect(
          feedbackUrl(
            transaction.commentId,
            "Access denied. Your GitHub account is not authorized.",
          ),
        );
        return;
      }
    } catch {
      res.redirect(
        feedbackUrl(
          transaction.commentId,
          "Membership check failed. Please try again.",
        ),
      );
      return;
    }
    res.cookie(sessionCookie, await tokens.signSession(user), {
      ...cookieOptions,
      maxAge: config.SESSION_EXPIRE_HOURS * 3600000,
    });
    res.redirect(feedbackUrl(transaction.commentId));
  });

  router.get("/me", requireSession, requireAllowedUser, (req, res) => {
    res.json({ user: req.user, csrfToken: req.csrfToken });
  });
  // Allow logout even when organization membership has been removed.
  router.post("/logout", requireSession, requireCsrf, (_req, res) => {
    res.clearCookie(sessionCookie, cookieOptions);
    res.clearCookie(loginCookie, cookieOptions);
    res.sendStatus(204);
  });

  return {
    router,
    corsOptions,
    requireSession,
    requireAllowedUser,
    requireCsrf,
  };
}
