import dotenv from "dotenv";
import fs from "node:fs";
import * as z from "zod";
dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  APP_ID: z.coerce.number().int().min(1),
  WEBHOOK_SECRET: z.string().min(1),
  PRIVATE_KEY_PATH: z.string().min(1),
  WEBHOOK_PROXY_URL: z.url(),
  OPENROUTER_API_KEY: z.string().min(1),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables", parsed.error);
  process.exit(1);
}
export const env = parsed.data;

export const privateKey = fs.readFileSync(env.PRIVATE_KEY_PATH, "utf8");
