import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  _clearMembershipCacheForTests,
  checkMembershipForUser,
} from "./checkMembershipForUser.js";

function makeFakeOctokit(impl: (...args: any[]) => any) {
  return { request: vi.fn(impl) } as any;
}

describe("checkMembershipForUser", () => {
  beforeEach(() => {
    _clearMembershipCacheForTests();
  });
  it("returns true when GitHub responds 204", async () => {
    const fakeOctokit = makeFakeOctokit(async () => ({ status: 204 }));

    const result = await checkMembershipForUser("user", fakeOctokit, "ExampleOrg");

    expect(result).toBe(true);
    expect(fakeOctokit.request).toHaveBeenCalledWith("GET /orgs/{org}/members/{username}", {
      org: "ExampleOrg",
      username: "user",
    });
  });

  it("does not reuse membership results across organizations", async () => {
    const fakeOctokit = makeFakeOctokit(async () => ({ status: 204 }));
    await checkMembershipForUser("user", fakeOctokit, "FirstOrg");
    fakeOctokit.request.mockResolvedValue({ status: 302 });
    expect(await checkMembershipForUser("user", fakeOctokit, "SecondOrg")).toBe(false);
    expect(fakeOctokit.request).toHaveBeenCalledTimes(2);
  });

  it("returns false when GitHub responds 302", async () => {
    const fakeOctokit = makeFakeOctokit(async () => ({ status: 302 }));

    const result = await checkMembershipForUser("bob", fakeOctokit, "ExampleOrg");

    expect(result).toBe(false);
  });

  it("returns false on 404 error", async () => {
    const fakeOctokit = makeFakeOctokit(async () => {
      const err: any = new Error("Not Found");
      err.status = 404;
      throw err;
    });

    const result = await checkMembershipForUser("carol", fakeOctokit, "ExampleOrg");

    expect(result).toBe(false);
  });

  it("rethrows unexpected errors", async () => {
    const fakeOctokit = makeFakeOctokit(async () => {
      throw new Error("network exploded");
    });

    await expect(checkMembershipForUser("dave", fakeOctokit, "ExampleOrg")).rejects.toThrow(
      "network exploded",
    );
  });
});
