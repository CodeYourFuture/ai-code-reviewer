import { describe, expect, it, vi } from "vitest";
import { getPRFiles } from "../networks/github.js";

describe("getPRFiles", () => {
  it("calls octokit and returns PR files", async () => {
    const mockFiles = [{ filename: "test.ts" }];

    const octokit = {
      request: vi.fn().mockResolvedValue({ data: mockFiles }),
    } as any;

    await getPRFiles("me", "repo", 123, octokit);

    expect(octokit.request).toHaveBeenCalledWith(
      "GET /repos/me/repo/pulls/123/files",
      { per_page: 100 },
    );
  });
});
