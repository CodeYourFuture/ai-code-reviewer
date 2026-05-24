import { z } from "zod";
export const ACTION = ["like", "dislike"] as const;

export const action = z.enum(ACTION);
export type actionTypes = z.infer<typeof action>;
