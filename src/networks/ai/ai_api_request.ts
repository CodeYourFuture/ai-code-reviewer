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
import { buildPRReviewPrompt } from "../../utils/buildPRReviewPrompt.js";
import { getSchema } from "../../utils/responseSchemas/getSchema.js";
import { badCommentsPrompt, basePrompt, topics } from "../ai/prompt.js";
import { askOpenRouterWithValidation } from "../ai/retryWithValidation.js";
import { validateFeedbackPoints } from "../../validateFeedbackPoints.js";
import { storeReview } from "../../db/storeReview.js";

const openRouter = new OpenRouter({
  apiKey: env.OPENROUTER_API_KEY,
});
// const FreeModel = "arcee-ai/trinity-large-preview:free";
export const MODEL = "openai/gpt-5.1";
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

const FEEDBACK_TYPE_PROMPTS: Record<string, string> = {
  "code quality": codeQualityPrompt,
  "comments quality": commentQualityPrompt,
};

function buildMessages(code: string, feedbackType: string): Message[] {
  const userMessage: Message = {
    role: "user",
    content: code,
  };

  const systemPrompt = getSystemPrompt(feedbackType);
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

export async function aiCall(
  code: string,
  feedbackType: string,
): Promise<string> {
  const messages: Message[] = buildMessages(code, feedbackType);
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

export async function runAiReview(
  files: PRFile[],
): Promise<AiResponseWithId[]> {
  const code = buildPRReviewPrompt({
    files,
  });
  console.log("--------- CODE --------\n", code);
  console.log("\n🤖 Sending PR diff to OpenRouter for review...\n");

  const feedbackPromises = FEEDBACK_TYPES.map((type) =>
    askOpenRouterWithValidation(code, type).then((review) => ({
      review,
      prompt: FEEDBACK_TYPE_PROMPTS[type.toLowerCase()],
    })),
  );

  const results = await Promise.allSettled(feedbackPromises);

  let combinedReview: ReviewWithPrompt[] = [];

  results.forEach((result) => {
    if (result.status === "fulfilled") {
      combinedReview.push(result.value);
    }
  });
  const SEVERITY_THRESHOLD = 2;
  combinedReview.forEach((review) => {
    if (review.review.feedback_type != "comments quality") {
      review.review.feedback_points = review.review.feedback_points.filter(
        (point) => point.severity > SEVERITY_THRESHOLD,
      );
    }
  });
  console.log("✅ Severity filtering completed");
  if (
    combinedReview.some(
      (response) => response.review.feedback_points.length > 0,
    )
  ) {
    combinedReview = combinedReview.map((reviewWithPrompt) => ({
      review: removeAdditionalLineNumbersAndSymbols(reviewWithPrompt.review),
      prompt: reviewWithPrompt.prompt,
    }));
  }
  console.log("✅ Line number removal completed");
  console.log("\n================ PR REVIEW ================\n");
  console.log(JSON.stringify(combinedReview, null, 2));
  console.log("\n==========================================\n");
  const validatedReview = validateFeedbackPoints(combinedReview, files);
  console.log("✅ Validation completed");
  let reviewWithIds: AiResponseWithId[] = []; // Initialize it here to avoid unassigned variable error
  //I put this condition here because sha can be string | null
  if (
    files[0].sha &&
    validatedReview.some(
      (response) => response.review.feedback_points.length > 0,
    )
  ) {
    console.log("📝 Storing review to database...");
    // files[0].sha contains the sha of the commit which ai reviewed
    reviewWithIds = await storeReview(validatedReview, MODEL, files[0].sha);
  } else {
    console.log("No review to store");
  }
  console.log("🏁 runAiReview completed");
  return reviewWithIds;
}

export function removeAdditionalLineNumbersAndSymbols(
  review: AiResponse,
): AiResponse {
  const sanitisedLineNumbers = review.feedback_points.flatMap((point) => {
    const match = point.line_numbers[0].match(/\d+(?:-\d+)?/);
    if (!match) return [];
    return [
      {
        ...point,
        line_numbers: [match[0], ...point.line_numbers.slice(1)],
      },
    ];
  });

  return { ...review, feedback_points: sanitisedLineNumbers };
}
