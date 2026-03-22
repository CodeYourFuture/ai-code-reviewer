import { OpenRouter } from "@openrouter/sdk";
import { ChatGenerationParams } from "@openrouter/sdk/models";
import { env } from "../config/env.js";
import { FeedbackResponse, FeedbackSchema } from "../types/aiResponse.js";
import { PRFile } from "../types/githubTypes.js";
import { buildPRReviewPrompt } from "../utils/buildPRReviewPrompt.js";
import { getSchema } from "../utils/responseSchemas/getSchema.js";
import { badCommentsPrompt, basePrompt, topics } from "./ai/prompt.js";
import { askOpenRouterWithValidation } from "./ai/retryWithValidation.js";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const FEEDBACK_TYPES = ["code quality", "comments quality"];
const openRouter = new OpenRouter({
  apiKey: env.OPENROUTER_API_KEY,
});
// const FreeModel = "arcee-ai/trinity-large-preview:free";
export const MODEL = "gpt-4.1";
export const codeQualityPrompt = `${basePrompt}
        Topics are: \n- ${topics.join(`\n- `)}`;
export const commentPrompt = badCommentsPrompt;
export const defaultChatParameters: Partial<ChatGenerationParams> = {
  temperature: 0,
  model: MODEL,
  responseFormat: {
    type: "json_schema",
    jsonSchema: getSchema,
  },
};
export async function aiCall(
  code: string,
  feedbackType: string = "code quality",
): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: "user",
      content: code,
    },
  ];
  if (feedbackType.toLocaleLowerCase() === "code quality") {
    messages.unshift({
      role: "system",
      content: codeQualityPrompt,
    });
  }
  if (feedbackType.toLocaleLowerCase() === "comments quality") {
    messages.unshift({
      role: "system",
      content: badCommentsPrompt,
    });
  }
  const completion = await openRouter.chat.send({
    ...defaultChatParameters,
    messages: messages,
    stream: false,
  });
  const res = completion.choices[0]?.message?.content;
  if (!res) {
    throw new Error("No content returned from OpenRouter");
  }
  if (typeof res !== "string") {
    throw new Error("Content returned from OpenRouter is not string");
  }
  return res;
}

export function validateFeedbackResponse(response: string): FeedbackResponse {
  console.log("validating response");
  const parsed = JSON.parse(response);
  return FeedbackSchema.parse(parsed);
}

export async function runAiReview(files: PRFile[]) {
  const code = buildPRReviewPrompt({
    files,
  });
  console.log("--------- CODE --------\n", code);
  console.log("\n🤖 Sending PR diff to OpenRouter for review...\n");
  const combinedReview: FeedbackResponse = { feedback_points: [] };
  const feedbackPromises = FEEDBACK_TYPES.map(
    async (type) => await askOpenRouterWithValidation(code, type),
  );
  const results = await Promise.allSettled(feedbackPromises);
  results.forEach((result) => {
    if (result.status === "fulfilled") {
      const feedback = result.value;
      combinedReview.feedback_points.push(...feedback.feedback_points);
    }
  });
  // const codeQualityReview = await askOpenRouterWithValidation(
  //   code,
  //   "code quality",
  // );

  combinedReview.feedback_points = combinedReview.feedback_points.filter(
    (point) => point.severity > 1,
  );
  console.log("\n================ PR REVIEW ================\n");
  console.log(combinedReview);
  console.log("\n==========================================\n");

  return combinedReview;
}
