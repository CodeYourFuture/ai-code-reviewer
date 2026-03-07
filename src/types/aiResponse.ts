import { z } from "zod";

export const FeedbackPointSchema = z
  .object({
    file_name: z
      .string()
      .describe("The name of the file where the feedback applies."),
    summary: z
      .string()
      .describe(
        "A very short summary of the problem, explained in the context of a beginner coder, without using any of the words in the title.",
      ),
    description: z
      .string()
      .describe(
        "A detailed explanation of the feedback given. All line numbers MUST be placed inside line_numbers and NEVER written inside the description text.",
      ),
    questions: z
      .string()
      .describe(
        `Use a "teaching" style not a "telling" style (e.g. "I've noticed you have some duplicated code here - if you had to change one copy of it you'd need to remember to change the other - how could you avoid that?" rather than "You should extract a function here")`,
      ),
    line_numbers: z
      .string()
      .describe(
        "The line numbers in the code where the feedback applies. Denoted as a comma separated list, with individual numbers or ranges of numbers (e.g. 3,4,10-15)",
      ),
    severity: z
      .number()
      .int()
      .min(1)
      .max(5)
      .describe(
        "The severity of the feedback. 1 is the lowest severity and 5 is the highest. The severity should be classified as 5=Critical, 4=High, 3=Medium, 2=Low, 1=Informational.",
      ),
  })
  .describe(
    "A collection of feedback points. Each feedback_point must refer to exactly one issue.",
  );

export const FeedbackSchema = z.object({
  feedback_points: z.array(FeedbackPointSchema),
});

export type FeedbackResponse = z.infer<typeof FeedbackSchema>;
export type FeedbackPoint = z.infer<typeof FeedbackPointSchema>;
