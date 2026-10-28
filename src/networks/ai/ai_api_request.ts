import { OpenRouter } from "@openrouter/sdk";
import { ChatGenerationParams, Message } from "@openrouter/sdk/models";
import { env } from "../../config/env.js";
import {
  AiResponse,
  AiResponseSchema,
  FEEDBACK_TYPES,
  ReviewWithPrompt,
} from "../../types/aiResponse.js";
import { PRFile } from "../../types/githubTypes.js";
import { prepareCodeForReview } from "../../utils/prepareCodeForReview.js";
import { getSchema } from "../../utils/responseSchemas/getSchema.js";
import { codeReviewPrompt } from "./prompt.js";
import { askOpenRouterWithValidation } from "./retryWithValidation.js";
import { validateFeedbackPoints } from "../../validation/validateFeedbackPoints.js";
import { removeAdditionalLineNumbersAndSymbols } from "../../validation/removeAdditionalLineNumbersAndSymbols.js";

const openRouter = new OpenRouter({ apiKey: env.OPENROUTER_API_KEY });
export const MODEL = "openai/gpt-6-luna";
export const defaultChatParameters: Partial<ChatGenerationParams> = {
  temperature: 0,
  model: MODEL,
  reasoning: { effort: "low" },
  // One response now covers every category, with room for five findings and reasoning.
  maxCompletionTokens: 6000,
  responseFormat: {
    type: "json_schema",
    jsonSchema: getSchema,
  },
};

export async function aiCall(
  messages: Message[],
  requestParams: Partial<ChatGenerationParams>,
): Promise<string> {
  const completion = await openRouter.chat.send({
    ...requestParams,
    messages,
    stream: false,
  });
  const res = completion.choices[0]?.message?.content;
  if (!res) throw new Error("No content returned from OpenRouter");
  if (typeof res !== "string") {
    throw new Error("Content returned from OpenRouter is not string");
  }
  console.log("===== Review response =====");
  console.log(res);
  return res;
}

export function validateAiResponse(response: string): AiResponse {
  return AiResponseSchema.parse(JSON.parse(response));
}

export async function runAiReview(files: PRFile[]): Promise<ReviewWithPrompt[]> {
  const messages: Message[] = [
    { role: "system", content: codeReviewPrompt },
    { role: "user", content: prepareCodeForReview({ files }) },
  ];
  const response = await askOpenRouterWithValidation(
    messages,
    defaultChatParameters,
  );
  // Keep the existing persistence/posting shape while reviewing both types together.
  const reviews: ReviewWithPrompt[] = FEEDBACK_TYPES.map((type) => {
    const review: ReviewWithPrompt = {
      feedback_type: type,
      feedback_points: response.feedback_points
        .filter((point) => point.feedback_type === type)
        .map(({ feedback_type: _type, ...point }) => point),
      prompt: codeReviewPrompt,
    };
    return {
      ...review,
      feedback_points: removeAdditionalLineNumbersAndSymbols(review),
    };
  });
  const validatedReview = validateFeedbackPoints(reviews, files);
  console.log("===== Validated review =====");
  console.log(JSON.stringify(validatedReview, null, 2));
  return validatedReview;
}
