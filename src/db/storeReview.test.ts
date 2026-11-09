import { beforeEach, expect, test, vi } from "vitest";
import pool from "./db.js";
import { getOrCreatePromptId, storeReview } from "./storeReview.js";
import { createCodeReviewPrompt } from "../networks/ai/prompt.js";

const codeReviewPrompt = createCodeReviewPrompt(5);

vi.mock("./db.js", () => ({ default: { query: vi.fn() } }));

beforeEach(() => vi.clearAllMocks());

test("stores the full long prompt and uses the hash index with an exact-text guard", async () => {
  vi.mocked(pool.query).mockResolvedValue({ rows: [{ id: 12 }] } as never);
  expect(await getOrCreatePromptId(codeReviewPrompt)).toBe(12);
  const [sql, values] = vi.mocked(pool.query).mock.calls[0];
  expect(sql).toContain("ON CONFLICT (md5(prompt))");
  expect(sql).toContain("WHERE prompts.prompt = EXCLUDED.prompt");
  expect(values).toEqual([codeReviewPrompt]);
});

test("fails explicitly rather than reusing another prompt's ID on a hash collision", async () => {
  vi.mocked(pool.query).mockResolvedValue({ rows: [] } as never);
  await expect(getOrCreatePromptId("different text")).rejects.toThrow("Prompt hash collision");
});

test("persists repository and PR context with each finding", async () => {
  vi.mocked(pool.query).mockResolvedValue({ rows: [{ id: 12 }] } as never);
  const result = await storeReview([{
    prompt: "Review instructions", feedback_type: "code quality",
    feedback_points: [{ file_name: "index.js", topic: "Correctness", point: "A finding", line_numbers: ["3-5"], severity: 4 }],
  }], "test-model", "commit-sha", { repoFullName: "owner/repo", pullRequestNumber: 42 });
  const [sql, values] = vi.mocked(pool.query).mock.calls[1];
  expect(sql).toContain("repo_full_name, pull_request_number");
  expect(values).toEqual(["code quality", "index.js", "Correctness", "A finding", "3-5", 4, "commit-sha", "test-model", 12, "owner/repo", 42]);
  expect(result[0].feedback_points[0].point_id).toBe(12);
});
