import { expect, test } from "vitest";
import { MigrationBuilder } from "node-pg-migrate";

test("adds timestamps without assigning migration time to historical rows", async () => {
  const path = "../../migrations/1794268800000_feedback-context.js";
  const migration = await import(path);
  const builder = new MigrationBuilder({} as never, undefined, false, console);
  migration.up(builder);
  const sql = builder.getSql();
  for (const table of ["ai_feedback_points", "users_feedback"]) {
    const addStatement = builder.getSqlSteps().find((step) => step.startsWith(`ALTER TABLE "${table}"`) && step.includes('ADD "created_at"'));
    expect(addStatement).toBeDefined();
    expect(addStatement).toContain('ADD "created_at" timestamptz;');
    expect(addStatement).not.toContain("DEFAULT");
    expect(sql).toContain(`ALTER TABLE "${table}"\n  ALTER "created_at" SET DEFAULT now();`);
  }
  expect(sql).not.toContain("UPDATE");
  expect(sql).toContain('ADD "github_comment_id" bigint');
});
