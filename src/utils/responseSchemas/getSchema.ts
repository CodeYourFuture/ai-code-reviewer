import * as z from "zod";

export function getSchema(responseSchema: z.ZodType) {
  return {
    name: "feedback",
    strict: true,
    schema: z.toJSONSchema(responseSchema),
  };
}
