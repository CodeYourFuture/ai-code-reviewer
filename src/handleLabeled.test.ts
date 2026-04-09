import type { EmitterWebhookEvent } from "@octokit/webhooks";
import type { Octokit } from "octokit";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleLabeled } from "./handleLabeled.js";
import { runAiReview } from "./networks/ai_api_request.js";
import { getPRFiles } from "./networks/github.js";
import { postInlineComments } from "./networks/postInlineComment.js";
import { postPRComment } from "./networks/postPrComment.js";

function makeEvent(labelName: string, sha = "abc123") {
  return {
    payload: {
      label: { name: labelName },
      repository: {
        owner: { login: "octocat" },
        name: "hello-world",
      },
      sender: { login: "Droid-An" },
      pull_request: {
        number: 42,
        head: { sha },
      },
    },
    octokit: {
      request: vi.fn().mockResolvedValue({ status: 204 }) as any,
    } as Octokit,
  } as unknown as EmitterWebhookEvent<"pull_request.labeled"> & {
    octokit: Octokit;
  };
}
const { prDiff } = vi.hoisted(() => ({
  prDiff: [
    {
      filename: "file1.js",
      patch: `@@ -0,0 +1,9 @@\n+import argparse\n+import sys\n+\n+\n+def parse_args():\n+    parser = argparse.ArgumentParser(\n+        description=\"Reads file(s) and writes them to the standard output\",\n+    )\n+    parser.add_argument(\"paths\", nargs=\"+\", help=\"The file path(s) to process\")\n`,
    },
    {
      filename: "file2.js",
      patch: `@@ -0,0 +1,9 @@\n+import argparse\n+import sys\n+\n+\n+def parse_args():\n+    parser = argparse.ArgumentParser(\n+        description=\"Reads file(s) and writes them to the standard output\",\n+    )\n+    parser.add_argument(\"paths\", nargs=\"+\", help=\"The file path(s) to process\")\n`,
    },
  ],
}));

// Mock dependencies used in handleLabeled
vi.mock("./networks/github.js", () => ({
  getPRFiles: vi.fn().mockResolvedValue(prDiff),
  logPRFiles: vi.fn(),
}));
vi.mock("./networks/ai_api_request.js", () => ({
  runAiReview: vi.fn().mockResolvedValue([
    {
      feedback_type: "code quality",
      feedback_points: [
        {
          file_name: "file1.js",
          topics: ["bad naming"],
          point: "Consider renaming this variable",
          line_numbers: ["8"],
          severity: 4,
        },
        {
          file_name: "file2.js",
          topics: ["duplicated code"],
          point: "Extract this into a function",
          line_numbers: ["1-3"],
          severity: 4,
        },
      ],
    },
  ]),
}));
vi.mock("./networks/postInlineComment.js", () => ({
  postInlineComments: vi.fn(),
}));
vi.mock("./networks/postPrComment.js", () => ({
  postPRComment: vi.fn(),
}));

describe("handleLabeled", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs AI review workflow when 'needs review' label is applied", async () => {
    // Arrange
    const event = makeEvent("needs review");

    // Act
    await handleLabeled(event);

    // Assert
    expect(getPRFiles).toHaveBeenCalledWith(
      "octocat",
      "hello-world",
      42,
      expect.anything(),
    );
    expect(runAiReview).toHaveBeenCalledWith(prDiff);
    expect(postPRComment).toBeCalled();
    expect(postInlineComments).toHaveBeenNthCalledWith(
      1,
      "octocat",
      "hello-world",
      42,
      expect.anything(),
      [
        {
          feedback_type: "code quality",
          feedback_points: [
            {
              file_name: "file1.js",
              topics: ["bad naming"],
              point: "Consider renaming this variable",
              line_numbers: ["8"],
              severity: 4,
            },
            {
              file_name: "file2.js",
              topics: ["duplicated code"],
              point: "Extract this into a function",
              line_numbers: ["1-3"],
              severity: 4,
            },
          ],
        },
      ],
      "abc123",
    );
  });
});
