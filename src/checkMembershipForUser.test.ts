import { beforeEach } from "node:test";
import { describe, expect, it, vi } from "vitest";
import { checkMembershipForUser } from "./checkMembershipForUser.js";

describe("checkMembershipForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  const org = "CodeYourFuture";

  it("calls GitHub membership endpoint", async () => {
    const request = vi.fn().mockResolvedValue({});
    const octokit = { request } as any;

    await checkMembershipForUser("Droid-An", octokit);

    expect(request).toHaveBeenCalledWith("GET /orgs/{org}/members/{username}", {
      org,
      username: "Droid-An",
    });
  });

  it("returns true if user is a member", async () => {
    const octokit = {
      request: vi.fn().mockResolvedValue({}),
    } as any;

    expect(await checkMembershipForUser("Droid-An", octokit)).toBe(true);
  });

  it("returns false if user is not a member", async () => {
    const octokit = {
      request: vi.fn().mockRejectedValue({ status: 404 }),
    } as any;

    expect(await checkMembershipForUser("Droid-An", octokit)).toBe(false);
  });
});
