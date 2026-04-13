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

  pgm.createTable("ai_feedback_points", {
    id: { type: "bigserial primary key", notNull: true },
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
  });

  pgm.createTable("user_feedback", {
    id: { type: "bigserial primary key", notNull: true },
    ai_review_id: { type: "bigint", references: "ai_feedback_points(id)" },
    username_github: "text",
    //user feedback: (I'm not sure how it will look like for now)
  });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.dropTable("user_feedback");
  pgm.dropTable("ai_feedback_points");
  pgm.dropTable("prompts");
};
