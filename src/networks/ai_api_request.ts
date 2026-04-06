import { OpenRouter } from "@openrouter/sdk";
import { ChatGenerationParams, Message } from "@openrouter/sdk/models";
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
import { validateFeedbackPoints } from "../validateFeedbackPoints.js";

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
  const SEVERITY_THRESHOLD = 2;
  combinedReview.forEach((review) => {
    if (review.feedback_type != "comments quality") {
      review.feedback_points = review.feedback_points.filter(
        (point) => point.severity > SEVERITY_THRESHOLD,
      );
    }
  });
  console.log(
    "✅ Severity filtering completed. Combined review now has",
    combinedReview.length,
    "responses",
  );
  if (combinedReview.some((response) => response.feedback_points.length > 0)) {
    combinedReview.forEach((review) => removeAdditionalLineNumbers(review));
  }
  console.log("✅ Line number removal completed");
  console.log("\n================ PR REVIEW ================\n");
  console.log(JSON.stringify(combinedReview, null, 2));
  console.log("\n==========================================\n");
  const validatedReview = validateFeedbackPoints(combinedReview, files);
  console.log(
    "✅ Validation completed. Validated review has",
    validatedReview.length,
    "responses",
  );
  //I put this condition here because sha can be string | null
  //commented out because I don't have db currently
  // if (
  //   files[0].sha &&
  //   validatedReview.some((response) => response.feedback_points.length > 0)
  // ) {
  //   console.log("📝 Storing review to database...");
  //   storeReview(
  //     validatedReview,
  //     MODEL,
  //     files[0].sha,
  //     [basePrompt, commentQualityPrompt],
  //     [topics],
  //   );
  // } else {
  //   console.log("No review to store");
  // }
  console.log("🏁 runAiReview completed");
  return validatedReview;
}
export function removeAdditionalLineNumbers(review: AiResponse): AiResponse {
  const sanitisedLineNumbers = review.feedback_points.map((point) => {
    if (point.line_numbers[0].includes(",")) {
      point.line_numbers[0] = point.line_numbers[0].split(", ")[0];
    }
    return point;
  });

  return {
    ...review,
    feedback_points: sanitisedLineNumbers,
  };
}
