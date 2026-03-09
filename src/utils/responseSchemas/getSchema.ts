import * as z from "zod";
import { FeedbackSchema } from "../../types/aiResponse.js";

export const getSchema = {
  name: "feedback",
  strict: true,
  schema: z.toJSONSchema(FeedbackSchema),
};
