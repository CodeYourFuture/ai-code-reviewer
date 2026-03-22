import { OpenRouter } from "@openrouter/sdk";
import { ChatGenerationParams } from "@openrouter/sdk/models";
import { env } from "../config/env.js";
import {
  AiResponse,
  AiResponseSchema,
  FEEDBACK_TYPES,
} from "../types/aiResponse.js";
import { PRFile } from "../types/githubTypes.js";
import { buildPRReviewPrompt } from "../utils/buildPRReviewPrompt.js";
import { getSchema } from "../utils/responseSchemas/getSchema.js";
import { badCommentsPrompt, basePrompt, topics } from "./ai/prompt.js";
import { askOpenRouterWithValidation } from "./ai/retryWithValidation.js";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const openRouter = new OpenRouter({
  apiKey: env.OPENROUTER_API_KEY,
});
// const FreeModel = "arcee-ai/trinity-large-preview:free";
export const MODEL = "gpt-4.1";
export const codeQualityPrompt = `${basePrompt}
        Topics are: \n- ${topics.join(`\n- `)}`;
export const commentQualityPrompt = badCommentsPrompt;
export const defaultChatParameters: Partial<ChatGenerationParams> = {
  temperature: 0,
  model: MODEL,
  responseFormat: {
    type: "json_schema",
    jsonSchema: getSchema,
  },
};

function buildMessages(code: string, feedbackType: string): ChatMessage[] {
  const base: ChatMessage[] = [{ role: "user", content: code }];

  const systemPrompt = getSystemPrompt(feedbackType);
  return systemPrompt
    ? [{ role: "system", content: systemPrompt }, ...base]
    : base;
}

function getSystemPrompt(type: string): string | null {
  switch (type.toLowerCase()) {
    case "code quality":
      return codeQualityPrompt;
    case "comments quality":
      return commentQualityPrompt;
    default:
      return null;
  }
}

export async function aiCall(
  code: string,
  feedbackType: string,
): Promise<string> {
  const messages: ChatMessage[] = buildMessages(code, feedbackType);
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

export function validateAiResponse(response: string): AiResponse {
  console.log("validating response");
  const parsed = JSON.parse(response);
  return AiResponseSchema.parse(parsed);
}

export async function runAiReview(files: PRFile[]): Promise<AiResponse[]> {
  const code = buildPRReviewPrompt({
    files,
  });
  console.log("--------- CODE --------\n", code);
  console.log("\n🤖 Sending PR diff to OpenRouter for review...\n");
  const combinedReview: AiResponse[] = [];
  const feedbackPromises = FEEDBACK_TYPES.map((type) =>
    askOpenRouterWithValidation(code, type),
  );

  const results = await Promise.allSettled(feedbackPromises);
  results.forEach((result) => {
    if (result.status === "fulfilled") {
      const feedback = result.value;
      combinedReview.push(feedback);
    }
  });
  combinedReview.forEach(
    (review) =>
      (review.feedback_points = review.feedback_points.filter(
        (point) => point.severity > 1,
      )),
  );
  console.log("\n================ PR REVIEW ================\n");
  console.log(JSON.stringify(combinedReview, null, 2));
  console.log("\n==========================================\n");

  return combinedReview;
}
