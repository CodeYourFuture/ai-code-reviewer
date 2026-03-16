import { OpenRouter } from "@openrouter/sdk";
import { env } from "../config/env.js";
import { FeedbackResponse, FeedbackSchema } from "../types/aiResponse.js";
import { PRFile } from "../types/githubTypes.js";
import { buildPRReviewPrompt } from "../utils/buildPRReviewPrompt.js";
import { getSchema } from "../utils/responseSchemas/getSchema.js";
import { basePrompt, topics } from "./ai/prompt.js";
import { retryWithValidation } from "./ai/retryWithValidation.js";
const openRouter = new OpenRouter({
  apiKey: env.OPENROUTER_API_KEY,
});
// const FreeModel = "arcee-ai/trinity-large-preview:free";
const MODEL = "gpt-4.1";

export async function aiCall(prompt: string): Promise<string> {
  const completion = await openRouter.chat.send({
    model: MODEL,
    stream: false,
    messages: [
      {
        role: "system",
        content: `${basePrompt}
        Topics are ${topics}`,
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    responseFormat: {
      type: "json_schema",
      jsonSchema: getSchema,
    },
  });

  const res = completion.choices[0]?.message?.content;
  if (!res) {
    throw new Error("No content returned from OpenRouter");
  }
  if (typeof res !== "string") {
    throw new Error("Content returned from OpenRouter is not string");
  }
  console.log(completion);
  return res;
}

export function validateFeedbackResponse(response: string): FeedbackResponse {
  console.log("validating response");
  const parsed = JSON.parse(response);
  return FeedbackSchema.parse(parsed);
}

export async function runAiReview(files: PRFile[]) {
  const prompt = buildPRReviewPrompt({
    files,
  });
  console.log("--------- PROMPT --------\n", prompt);
  console.log("\n🤖 Sending PR diff to OpenRouter for review...\n");

  const review = await askOpenRouter(prompt);
  const importantFeedback = review.feedback_points.filter(
    (point) => point.severity > 1,
  );
  console.log("\n================ PR REVIEW ================\n");
  console.log(importantFeedback);
  console.log("\n==========================================\n");

  return importantFeedback;
}

export async function askOpenRouter(prompt: string): Promise<FeedbackResponse> {
  return retryWithValidation(prompt);
}
