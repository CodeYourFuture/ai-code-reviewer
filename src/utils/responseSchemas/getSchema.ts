import * as z from "zod";
import { AiResponseSchema } from "../../types/aiResponse.js";

export const getSchema = {
  name: "feedback",
  strict: true,
  schema: z.toJSONSchema(AiResponseSchema),
};
