import { OpenRouter } from "@openrouter/sdk";
import { ChatGenerationParams, Message } from "@openrouter/sdk/models";
import { env } from "../../config/env.js";
import {
  AiResponse,
  AiResponseSchema,
  FEEDBACK_TYPES,
  ReviewWithPrompt,
} from "../../types/aiResponse.js";
import type { PRFileWithContent } from "../../types/githubTypes.js";
import {
  prepareCodeForReview,
  preparePatchForReview,
} from "../../utils/prepareCodeForReview.js";
import { getSchema } from "../../utils/responseSchemas/getSchema.js";
import { codeReviewPrompt } from "./prompt.js";
import { askOpenRouterWithValidation } from "./retryWithValidation.js";
import { validateFeedbackPoints } from "../../validation/validateFeedbackPoints.js";
import { removeAdditionalLineNumbersAndSymbols } from "../../validation/removeAdditionalLineNumbersAndSymbols.js";

const openRouter = new OpenRouter({ apiKey: env.OPENROUTER_API_KEY });
const FULL_FILE_PREVIEW_LINES = 5;
export const MODEL = "openai/gpt-6-luna";
export const defaultChatParameters: Partial<ChatGenerationParams> = {
  temperature: 0,
  model: MODEL,
  reasoning: { effort: "medium" },
  // One response now covers every category, with room for five findings and reasoning.
  maxCompletionTokens: 25000,
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
  const finishReason = completion.choices[0]?.finishReason ?? null;
  const usage = completion.usage;
  console.log("===== Review completion metadata =====");
  console.log(
    JSON.stringify({
      model: completion.model,
      finishReason,
      usage: usage
        ? {
            promptTokens: usage.promptTokens,
            cachedPromptTokens:
              usage.promptTokensDetails?.cachedTokens ?? null,
            completionTokens: usage.completionTokens,
            reasoningTokens:
              usage.completionTokensDetails?.reasoningTokens ?? null,
            totalTokens: usage.totalTokens,
          }
        : null,
    }),
  );
  if (finishReason === "length") {
    console.warn(
      `OpenRouter stopped the review because it reached the ${requestParams.maxCompletionTokens ?? "configured"}-token completion limit.`,
    );
  }

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

function logReviewInput(files: PRFileWithContent[]) {
  console.log("===== Review diffs =====");
  for (const file of files) {
    console.log(`--- ${file.filename} (${file.status}) ---`);
    console.log(preparePatchForReview(file.patch));
  }

  console.log(
    `===== Full-file context previews (first ${FULL_FILE_PREVIEW_LINES} lines) =====`,
  );
  for (const file of files) {
    if (typeof file.fullContent !== "string") continue;

    const preview = file.fullContent
      .split(/\r\n|\n|\r/)
      .slice(0, FULL_FILE_PREVIEW_LINES)
      .join("\n");
    console.log(`--- ${file.filename} ---`);
    console.log(preview || "(empty file)");
  }
}

export async function runAiReview(
  files: PRFileWithContent[],
): Promise<ReviewWithPrompt[]> {
  if (env.NODE_ENV !== "production") logReviewInput(files);
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
