import { z } from "zod";

// If you declare your string array as a variable, Zod won't be able to properly infer the exact values of each element
// To fix this, always pass the array directly into the z.enum() function, or use as const.
// https://zod.dev/api?id=enums
export const FEEDBACK_TYPES = ["code quality"] as const;

export const FeedbackPointSchema = z
  .object({
    file_name: z
      .string()
      .describe("The name of the file where the issue exist."),
    topics: z
      .array(z.string())
      .describe(
        "The list of topics from the prompt used to evaluate the issue. If same issue falls under several topic, list them all",
      ),
    line_numbers: z
      .array(z.string())
      .max(1)
      .describe(
        "The line numbers in the code where the issue lies. Denoted as an individual number or range of numbers (e.g. ['3'] or ['10-15'], but not ['5-6,15-16,25-26,31-32'])",
      ),
    severity: z
      .number()
      .int()
      .min(1)
      .max(10)
      .describe(
        "The severity of the issue. The severity should be classified as: 1 — Cosmetic, 2 — Very Low, 3 — Low, 4 — Moderate-Low, 5 — Moderate, 6 — Moderate-High, 7 — High, 8 — Very High, 9 — Critical, 10 — Blocker",
      ),
  })
  .describe(
    "A collection of problematic code Each issue_point must refer to exactly one issue.",
  );

export const AiResponseSchema = z.object({
  feedback_type: z.enum(FEEDBACK_TYPES),
  feedback_points: z.array(FeedbackPointSchema),
});
//currently not in use
export const CommentPointSchema = z
  .object({
    file_name: z
      .string()
      .describe("The name of the file where the feedback applies."),
    point: z
      .string()
      .describe(
        `A detailed explanation of the issue you are giving feedback on. If you ask question to nudge trainee towards better practices, use a "teaching" style not a "telling" style (e.g. "I've noticed you have some duplicated code here - if you had to change one copy of it you'd need to remember to change the other - how could you avoid that?" rather than "You should extract a function here")`,
      ),
    line_numbers: z
      .string()
      .describe(
        "The line numbers in the code where the feedback applies. If issue lies in several location within one function, return one line range that covers both issues. When referring to bad naming, only return line numbers where that naming declared. Denoted as a comma separated list, with individual numbers or ranges of numbers (e.g. 3,4,10-15)",
      ),
  })
  .describe("A collection of feedback points.");
// Always create a TypeScript type from the schema using z.infer.
export type AiResponse = z.infer<typeof AiResponseSchema>;
export type FeedbackPoint = z.infer<typeof FeedbackPointSchema>;
