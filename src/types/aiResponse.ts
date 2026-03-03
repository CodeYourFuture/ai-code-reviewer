import { z } from "zod";

export const FeedbackSchema = z.object({
  feedback_points: z.array(
    z.object({
      file_name: z.string(),
      summary: z.string(),
      description: z.string(),
      questions: z.string(),
      line_numbers: z.string(),
      severity: z.number().int().min(1).max(5),
    }),
  ),
});

export const FeedbackPointSchema = z.object({
  file_name: z.string(),
  summary: z.string(),
  description: z.string(),
  questions: z.string(),
  line_numbers: z.string(),
  severity: z.number().int().min(1).max(5),
});

export type FeedbackResponse = z.infer<typeof FeedbackSchema>;
export type FeedbackPoint = z.infer<typeof FeedbackPointSchema>;
