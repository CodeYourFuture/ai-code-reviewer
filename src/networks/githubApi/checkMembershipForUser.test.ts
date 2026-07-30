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

    const result = await checkMembershipForUser("user", fakeOctokit);

    expect(result).toBe(true);
  });

  it("returns false when GitHub responds 302", async () => {
    const fakeOctokit = makeFakeOctokit(async () => ({ status: 302 }));

    const result = await checkMembershipForUser("bob", fakeOctokit);

    expect(result).toBe(false);
  });

  it("returns false on 404 error", async () => {
    const fakeOctokit = makeFakeOctokit(async () => {
      const err: any = new Error("Not Found");
      err.status = 404;
      throw err;
    });

    const result = await checkMembershipForUser("carol", fakeOctokit);

    expect(result).toBe(false);
  });

  it("rethrows unexpected errors", async () => {
    const fakeOctokit = makeFakeOctokit(async () => {
      throw new Error("network exploded");
    });

    await expect(checkMembershipForUser("dave", fakeOctokit)).rejects.toThrow(
      "network exploded",
    );
  });
});
