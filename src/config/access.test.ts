import { describe, expect, it, vi } from "vitest";
import { accessSchema, isGithubUserAllowed } from "./access.js";

describe("GitHub access policy", () => {
  it("normalizes the development allowlist and never queries the organization", async () => {
    const config = accessSchema.parse({ NODE_ENV: "development", DEV_GITHUB_USER_ALLOWLIST: " Alice, BOB, " });
    const check = vi.fn();
    expect(await isGithubUserAllowed("ALICE", config, check)).toBe(true);
    expect(await isGithubUserAllowed("mallory", config, check)).toBe(false);
    expect(check).not.toHaveBeenCalled();
  });

  it("denies development access with an empty allowlist", async () => {
    const config = accessSchema.parse({ NODE_ENV: "development" });
    expect(await isGithubUserAllowed("alice", config, vi.fn())).toBe(false);
  });

  it("defaults to production and uses the organization result", async () => {
    const config = accessSchema.parse({});
    expect(config.NODE_ENV).toBe("production");
    const check = vi.fn().mockResolvedValue(false);
    expect(await isGithubUserAllowed("alice", config, check)).toBe(false);
    check.mockResolvedValue(true);
    expect(await isGithubUserAllowed("alice", config, check)).toBe(true);
  });

  it("propagates production lookup failures", async () => {
    await expect(isGithubUserAllowed("alice", accessSchema.parse({}), async () => { throw new Error("unavailable"); })).rejects.toThrow("unavailable");
  });

  it("rejects production allowlists and unsupported environments", () => {
    expect(accessSchema.safeParse({ NODE_ENV: "production", DEV_GITHUB_USER_ALLOWLIST: "alice" }).success).toBe(false);
    expect(accessSchema.safeParse({ NODE_ENV: "prod" }).success).toBe(false);
    expect(accessSchema.safeParse({ GITHUB_MEMBERSHIP_ORG: " " }).success).toBe(false);
  });
});
