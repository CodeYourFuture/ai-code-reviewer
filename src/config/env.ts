import dotenv from "dotenv";
import fs from "node:fs";
import * as z from "zod";
dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  APP_ID: z.coerce.number().int().min(1),
  WEBHOOK_SECRET: z.string().min(1),

  // dev option
  GITHUB_PRIVATE_KEY_PATH: z.string().optional(),

  // production option
  GITHUB_PRIVATE_KEY: z.string().optional(),

  WEBHOOK_PROXY_URL: z.url().optional(),
  OPENROUTER_API_KEY: z.string().min(1),

  // Database
  DATABASE_URL: z.string(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables", parsed.error);
  process.exit(1);
}
export const env = parsed.data;

export const privateKey = (() => {
  if (env.GITHUB_PRIVATE_KEY) {
    return env.GITHUB_PRIVATE_KEY.replace(/\\n/g, "\n");
  }

  if (env.GITHUB_PRIVATE_KEY_PATH) {
    return fs.readFileSync(env.GITHUB_PRIVATE_KEY_PATH, "utf8");
  }

  throw new Error("Either PRIVATE_KEY or PRIVATE_KEY_PATH must be provided");
})();
