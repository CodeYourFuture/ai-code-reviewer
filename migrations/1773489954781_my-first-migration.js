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
  pgm.createTable("prompts", {
    id: { type: "bigserial primary key", notNull: true },
    prompt: "text",
  });

  pgm.createTable("feedback_points", {
    id: { type: "bigserial primary key", notNull: true },
    ai_review: "text",
    commit_sha: { type: "varchar(50)", notNull: true },
    llm_model: "varchar",
    prompt_id: { type: "bigint", references: "prompts(id)" },
  });

  pgm.createTable("feedback", {
    id: { type: "bigserial primary key", notNull: true },
    review_id: { type: "bigint", references: "review(id)" },
  });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.dropColumn("feedback", "prompt_id");
  pgm.dropTable("feedback");
  pgm.dropTable("prompts");
};
