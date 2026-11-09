/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
export const up = (pgm) => {
  pgm.addColumns("ai_feedback_points", {
    repo_full_name: { type: "text" },
    pull_request_number: { type: "integer" },
    github_comment_id: { type: "bigint" },
    github_comment_url: { type: "text" },
    created_at: { type: "timestamptz" },
  });
  pgm.addColumns("users_feedback", {
    created_at: { type: "timestamptz" },
  });
  // Leave historical creation times unknown; only new inserts get a timestamp.
  for (const table of ["ai_feedback_points", "users_feedback"]) {
    pgm.alterColumn(table, "created_at", { default: pgm.func("now()") });
  }
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
export const down = (pgm) => {
  pgm.dropColumns("ai_feedback_points", [
    "repo_full_name", "pull_request_number", "github_comment_id",
    "github_comment_url", "created_at",
  ]);
  pgm.dropColumns("users_feedback", ["created_at"]);
};
