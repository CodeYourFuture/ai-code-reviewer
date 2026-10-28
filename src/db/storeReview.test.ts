import { beforeEach, expect, test, vi } from "vitest";
import pool from "./db.js";
import { getOrCreatePromptId } from "./storeReview.js";
import { codeReviewPrompt } from "../networks/ai/prompt.js";

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
