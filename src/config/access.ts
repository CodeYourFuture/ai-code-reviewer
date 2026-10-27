import { z } from "zod";

export const accessSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("production"),
  GITHUB_MEMBERSHIP_ORG: z.string().trim().min(1).default("CodeYourFuture"),
  DEV_GITHUB_USER_ALLOWLIST: z.string().default("").transform((value) =>
    value.split(",").map((user) => user.trim().toLowerCase()).filter(Boolean),
  ),
}).superRefine((config, ctx) => {
  if (config.NODE_ENV === "production" && config.DEV_GITHUB_USER_ALLOWLIST.length) {
    ctx.addIssue({ code: "custom", path: ["DEV_GITHUB_USER_ALLOWLIST"], message: "Development allowlist must be empty in production" });
  }
});

export type AccessConfig = z.infer<typeof accessSchema>;

export async function isGithubUserAllowed(
  username: string,
  config: AccessConfig,
  checkOrganization: () => Promise<boolean>,
): Promise<boolean> {
  if (config.NODE_ENV !== "production") {
    return config.DEV_GITHUB_USER_ALLOWLIST.includes(username.toLowerCase());
  }
  return checkOrganization();
}
