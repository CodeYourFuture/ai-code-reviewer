import { z } from "zod";

const httpUrl = z
  .url()
  .refine(
    (value) =>
      URL.canParse(value) &&
      ["http:", "https:"].includes(new URL(value).protocol),
    "Expected an HTTP(S) URL",
  );

export const authSchema = z.object({
  GITHUB_APP_CLIENT_ID: z.string().trim().min(1),
  GITHUB_APP_CLIENT_SECRET: z.string().trim().min(1),
  GITHUB_OAUTH_CALLBACK_URL: httpUrl.refine((value) => {
    if (!URL.canParse(value)) return false;
    const url = new URL(value);
    return (
      url.pathname === "/api/auth/callback" &&
      !url.search &&
      !url.hash &&
      !url.username &&
      !url.password
    );
  }, "Expected the backend /api/auth/callback URL without query parameters"),
  SESSION_SECRET_KEY: z.string().min(32),
  SESSION_EXPIRE_HOURS: z.coerce.number().int().min(1).max(168).default(24),
  FRONTEND_BASE_URL: httpUrl.refine((value) => {
    if (!URL.canParse(value)) return false;
    const url = new URL(value);
    return (
      url.pathname === "/" &&
      !url.search &&
      !url.hash &&
      !url.username &&
      !url.password
    );
  }, "Expected the frontend origin without a path or query parameters"),
});

export type AuthConfig = z.infer<typeof authSchema> & {
  NODE_ENV: "development" | "production" | "test";
};
