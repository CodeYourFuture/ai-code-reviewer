import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPRFiles,
  MAX_FULL_FILE_CONTEXT_BYTES,
  MAX_TOTAL_FULL_FILE_CONTEXT_BYTES,
} from "./github.js";

function fileContent(content: Buffer) {
  return { data: content };
}

describe("getPRFiles", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("adds full UTF-8 content using the PR head commit", async () => {
    const mockFiles = [
      { filename: "src/test.ts", status: "modified" },
      { filename: "empty.txt", status: "added" },
    ];
    const octokit = {
      request: vi.fn().mockImplementation((route: string, params: object) => {
        if (route === "GET /repos/me/repo/pulls/123/files") {
          return Promise.resolve({ data: mockFiles });
        }
        const path = (params as { path: string }).path;
        return Promise.resolve(
          fileContent(Buffer.from(path === "empty.txt" ? "" : "const value = 1;\n")),
        );
      }),
    } as any;

    const files = await getPRFiles("me", "repo", 123, octokit, "head-sha");

    expect(files).toEqual([
      { ...mockFiles[0], fullContent: "const value = 1;\n" },
      { ...mockFiles[1], fullContent: "" },
    ]);
    expect(octokit.request).toHaveBeenCalledWith(
      "GET /repos/me/repo/pulls/123/files",
      { per_page: 100 },
    );
    expect(octokit.request).toHaveBeenCalledWith(
      "GET /repos/{owner}/{repo}/contents/{path}",
      {
        owner: "me",
        repo: "repo",
        path: "src/test.ts",
        ref: "head-sha",
        headers: { accept: "application/vnd.github.raw+json" },
      },
    );
  });

  it("omits full content for binary and deleted files", async () => {
    const mockFiles = [
      { filename: "image.png", status: "modified" },
      { filename: "old.ts", status: "removed" },
    ];
    const octokit = {
      request: vi.fn().mockImplementation((route: string) => {
        if (route === "GET /repos/me/repo/pulls/123/files") {
          return Promise.resolve({ data: mockFiles });
        }
        return Promise.resolve(fileContent(Buffer.from([0, 1, 2, 3])));
      }),
    } as any;

    const files = await getPRFiles("me", "repo", 123, octokit, "head-sha");

    expect(files).toEqual([
      {
        ...mockFiles[0],
        fullContentOmittedReason: expect.stringContaining("binary or non-UTF-8"),
      },
      {
        ...mockFiles[1],
        fullContentOmittedReason: expect.stringContaining("deleted files"),
      },
    ]);
    expect(octokit.request).toHaveBeenCalledTimes(2);
  });

  it("omits content that exceeds the per-file budget", async () => {
    const mockFiles = [{ filename: "large.txt", status: "modified" }];
    const octokit = {
      request: vi.fn().mockImplementation((route: string) => {
        if (route.endsWith("/files")) return Promise.resolve({ data: mockFiles });
        return Promise.resolve(
          fileContent(Buffer.alloc(MAX_FULL_FILE_CONTEXT_BYTES + 1, "a")),
        );
      }),
    } as any;

    const [file] = await getPRFiles(
      "me",
      "repo",
      123,
      octokit,
      "head-sha",
    );

    expect(file.fullContent).toBeUndefined();
    expect(file.fullContentOmittedReason).toContain("per-file limit");
  });

  it("applies the total budget in PR file order", async () => {
    const content = Buffer.alloc(MAX_FULL_FILE_CONTEXT_BYTES, "a");
    const fileCount = Math.floor(
      MAX_TOTAL_FULL_FILE_CONTEXT_BYTES / MAX_FULL_FILE_CONTEXT_BYTES,
    ) + 1;
    const mockFiles = Array.from({ length: fileCount }, (_, index) => ({
      filename: `${index}.txt`,
      status: "modified",
    }));
    const octokit = {
      request: vi.fn().mockImplementation((route: string) => {
        if (route.endsWith("/files")) return Promise.resolve({ data: mockFiles });
        return Promise.resolve(fileContent(content));
      }),
    } as any;

    const files = await getPRFiles("me", "repo", 123, octokit, "head-sha");

    expect(files.slice(0, -1).every((file) => file.fullContent)).toBe(true);
    expect(files.at(-1)?.fullContent).toBeUndefined();
    expect(files.at(-1)?.fullContentOmittedReason).toContain(
      "total context limit",
    );
  });

  it("looks up the head commit when it is not supplied", async () => {
    const octokit = {
      request: vi.fn().mockImplementation((route: string) => {
        if (route.endsWith("/files")) return Promise.resolve({ data: [] });
        return Promise.resolve({ data: { head: { sha: "looked-up-sha" } } });
      }),
    } as any;

    await getPRFiles("me", "repo", 123, octokit);

    expect(octokit.request).toHaveBeenCalledWith(
      "GET /repos/{owner}/{repo}/pulls/{pull_number}",
      { owner: "me", repo: "repo", pull_number: 123 },
    );
  });

  it("keeps the diff when full content cannot be fetched", async () => {
    const mockFiles = [{ filename: "src/test.ts", status: "modified" }];
    const octokit = {
      request: vi.fn().mockImplementation((route: string) => {
        if (route.endsWith("/files")) return Promise.resolve({ data: mockFiles });
        return Promise.reject(new Error("content unavailable"));
      }),
    } as any;
    await expect(
      getPRFiles("me", "repo", 123, octokit, "head-sha"),
    ).resolves.toEqual([
      {
        ...mockFiles[0],
        fullContentOmittedReason: expect.stringContaining(
          "could not be retrieved",
        ),
      },
    ]);
  });
});
