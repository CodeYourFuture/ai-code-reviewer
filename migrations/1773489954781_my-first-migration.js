/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  pgm.createTable(
    "prompts",
    {
      id: { type: "bigserial", primaryKey: true, notNull: true },
      prompt: { type: "text", unique: true },
    },
    { ifNotExists: true },
  );
  pgm.createType("feedback", ["like", "dislike"], { ifNotExists: true });
  pgm.createTable(
    "ai_feedback_points",
    {
      id: { type: "bigserial", primaryKey: true, notNull: true },
      feedback_type: {
        type: "text",
        notNull: true,
      },
      file_name: {
        type: "text",
        notNull: true,
      },
      review_topic: {
        type: "text",
        notNull: true,
      },
      point: {
        type: "text",
        notNull: true,
      },
      line_number: {
        type: "text",
        notNull: true,
      },
      severity: {
        type: "integer",
        notNull: true,
      },
      commit_sha: { type: "varchar(50)", notNull: true },
      llm_model: "varchar",
      prompt_id: { type: "bigint", references: "prompts(id)" },
    },
    { ifNotExists: true },
  );

  pgm.createTable(
    "user_feedback",
    {
      id: { type: "bigserial", primaryKey: true, notNull: true },
      ai_review_id: { type: "bigint", references: "ai_feedback_points(id)" },
      username_github: "text",
      user_github_id: "integer",
      user_feedback: { type: "feedback" },
    },
    { ifNotExists: true },
  );
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.dropTable("user_feedback", { ifExists: true });
  pgm.dropTable("ai_feedback_points", { ifExists: true });
  pgm.dropTable("prompts", { ifExists: true });
  pgm.dropType("feedback", { ifExists: true, cascade: true });
};
