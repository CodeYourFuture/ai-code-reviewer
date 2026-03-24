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
  pgm.createTable("review_topics", {
    id: { type: "bigserial primary key", notNull: true },
    topics: "text",
  });

  pgm.createTable("reviews", {
    id: { type: "bigserial primary key", notNull: true },
    ai_review: "text",
    commit_sha: { type: "varchar(50)", notNull: true },
    llm_model: "varchar",
    prompt_id: { type: "bigint", references: "prompts(id)" },
    review_topics_id: { type: "bigint", references: "review_topics(id)" },
  });

  pgm.createTable("user_feedback", {
    id: { type: "bigserial primary key", notNull: true },
    ai_review_id: { type: "bigint", references: "reviews(id)" },
    username_github: "text",
    //feedback
  });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.dropTable("user_feedback");
  pgm.dropTable("reviews");
  pgm.dropTable("review_topics");
  pgm.dropTable("prompts");
};
