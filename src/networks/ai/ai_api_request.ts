import { OpenRouter } from "@openrouter/sdk";
import { ChatGenerationParams, Message } from "@openrouter/sdk/models";
import { env } from "../../config/env.js";
import {
  AiResponse,
  AiResponseSchema,
  AiResponseWithId,
  FEEDBACK_TYPES,
  ReviewWithPrompt,
} from "../../types/aiResponse.js";
import { PRFile } from "../../types/githubTypes.js";
import { prepareCodeForReview } from "../../utils/prepareCodeForReview.js";
import { getSchema } from "../../utils/responseSchemas/getSchema.js";
import {
  badCommentsPrompt,
  basePrompt,
  codeQualityTopics,
  commentsQualityTopics,
} from "../ai/prompt.js";
import { askOpenRouterWithValidation } from "../ai/retryWithValidation.js";
import { validateFeedbackPoints } from "../../validation/validateFeedbackPoints.js";
import { storeReview } from "../../db/storeReview.js";
import { removeAdditionalLineNumbersAndSymbols } from "../../validation/removeAdditionalLineNumbersAndSymbols.js";

const openRouter = new OpenRouter({
  apiKey: env.OPENROUTER_API_KEY,
});
// export const MODEL = "nvidia/nemotron-3-ultra-550b-a55b:free";
export const MODEL = "openai/gpt-5.1";
export const codeQualityPrompt = basePrompt;
export const commentQualityPrompt = badCommentsPrompt;
export const defaultChatParameters: Partial<ChatGenerationParams> = {
  temperature: 0,
  model: MODEL,
  // commented out because free models can't understand these properties
  responseFormat: {
    type: "json_schema",
    jsonSchema: getSchema,
  },
};
export const codeQualityParametersAddons: Partial<ChatGenerationParams> = {
  reasoning: {
    effort: "low",
  },
};
export const commentsQualityParametersAddons: Partial<ChatGenerationParams> = {
  maxCompletionTokens: 2000, //I don't want to burn tokens to get lots of feedback about code comments if I will filter them out when there are more than 3 feedback points
};

const FEEDBACK_TYPE_PROMPTS: Record<string, string> = {
  "code quality": codeQualityPrompt,
  "comments quality": commentQualityPrompt,
};

function buildMessages(
  code: string,
  feedbackType: string,
  topic: string,
): Message[] {
  const userMessage: Message = {
    role: "user",
    content: code,
  };

  const systemPrompt = `${getSystemPrompt(feedbackType)}
  Topic is: ${topic}`;
  return systemPrompt
    ? [{ role: "system", content: systemPrompt }, userMessage]
    : [userMessage];
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
function getTopics(feedbackType: string): string[] {
  switch (feedbackType.toLowerCase()) {
    case "code quality":
      return codeQualityTopics;
    case "comments quality":
      return commentsQualityTopics;
    default:
      return ["no topics"];
  }
}

function getRequestParams(
  feedbackType: string,
): Partial<ChatGenerationParams> | null {
  switch (feedbackType.toLowerCase()) {
    case "code quality":
      return codeQualityParametersAddons;
    case "comments quality":
      return commentsQualityParametersAddons;
    default:
      return null;
  }
}

export async function aiCall(
  messages: Message[],
  requestParams: Partial<ChatGenerationParams>,
): Promise<string> {
  const completion = await openRouter.chat.send({
    ...requestParams,
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
  console.log("===== resposnse =====");
  console.log(JSON.stringify(completion.choices[0]?.message, null, 2));
  console.log("===== reasoning =====");
  console.log(completion.choices[0]?.message?.reasoning);
  return res;
}

export function validateAiResponse(response: string): AiResponse {
  const parsed = JSON.parse(response);
  return AiResponseSchema.parse(parsed);
}

export async function runAiReview(
  files: PRFile[],
): Promise<ReviewWithPrompt[]> {
  const code = prepareCodeForReview({
    files,
  });

  const feedbackPromises = FEEDBACK_TYPES.flatMap((type) => {
    //construct messages here to keep ai call flow simple
    console.log("current type ", type);
    const responsePromises = [];
    const topics = getTopics(type);

    for (const topic of topics) {
      console.log("current topic", topic);
      const messages: Message[] = buildMessages(code, type, topic);
      const requestParams = {
        ...defaultChatParameters,
        ...(getRequestParams(type) ?? {}),
      };
      console.log("======= req params ========\n", requestParams);
      responsePromises.push(
        askOpenRouterWithValidation(messages, requestParams).then((review) => ({
          review,
          prompt:
            FEEDBACK_TYPE_PROMPTS[type.toLowerCase()] + ` Topic is: ` + topic,
        })),
      );
    }
    return responsePromises;
  });

  const results = await Promise.allSettled(feedbackPromises);

  let combinedReview: ReviewWithPrompt[] = [];

  results.forEach((result) => {
    if (result.status === "fulfilled") {
      combinedReview.push(result.value);
    }
  });
  console.log(JSON.stringify(combinedReview, null, 4));
  const SEVERITY_THRESHOLD = 2;
  combinedReview.forEach((review) => {
    if (review.review.feedback_type != "comments quality") {
      review.review.feedback_points = review.review.feedback_points.filter(
        (point) => point.severity > SEVERITY_THRESHOLD,
      );
    }
  });

  if (
    combinedReview.some(
      (response) => response.review.feedback_points.length > 0,
    )
  ) {
    combinedReview = combinedReview.map((reviewWithPrompt) => ({
      review:
        reviewWithPrompt.review.feedback_points.length > 0
          ? removeAdditionalLineNumbersAndSymbols(reviewWithPrompt.review)
          : reviewWithPrompt.review,
      prompt: reviewWithPrompt.prompt,
    }));
  }

  const validatedReview = validateFeedbackPoints(combinedReview, files);

  return validatedReview;
}

export async function persistReview(
  review: ReviewWithPrompt[],
  sha: string,
): Promise<AiResponseWithId[]> {
  let reviewWithIds: AiResponseWithId[] = []; // Initialize it here to avoid unassigned variable error
  if (review.some((response) => response.review.feedback_points.length > 0)) {
    reviewWithIds = await storeReview(review, MODEL, sha);
  } else {
  }

  return reviewWithIds;
}
