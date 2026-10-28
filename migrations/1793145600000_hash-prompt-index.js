/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
export const up = (pgm) => {
  // Index a fixed-size fingerprint instead of potentially unbounded prompt text.
  pgm.sql("CREATE UNIQUE INDEX prompts_prompt_md5_key ON prompts (md5(prompt))");
  pgm.dropConstraint("prompts", "prompts_prompt_key");
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
export const down = (pgm) => {
  // This can fail if long prompts have since been stored. Keep the hash index
  // until the original constraint is successfully restored; never delete data.
  pgm.addConstraint("prompts", "prompts_prompt_key", { unique: ["prompt"] });
  pgm.sql("DROP INDEX prompts_prompt_md5_key");
};
