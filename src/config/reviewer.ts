import { z } from "zod";

const booleanFromEnvironment = z.union([
  z.boolean(),
  z.enum(["true", "false"]).transform((value) => value === "true"),
]);

export const reviewerConfigSchema = z.object({
  AI_MODEL: z.string().trim().min(1).default("openai/gpt-6-luna"),
  AI_REASONING_EFFORT: z
    .enum(["none", "minimal", "low", "medium", "high", "xhigh", "max"])
    .default("medium"),
  AI_MAX_COMPLETION_TOKENS: z.coerce.number().int().positive().default(25000),
  MULTIPLE_REVIEWS_ALLOWED: booleanFromEnvironment.default(false),
});

export type ReviewerConfig = z.infer<typeof reviewerConfigSchema>;
