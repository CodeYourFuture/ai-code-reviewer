import { ChatGenerationParams, Message } from "@openrouter/sdk/models";
import { AiResponse } from "../../types/aiResponse.js";
import { aiCall, validateAiResponse } from "../ai/ai_api_request.js";
import { z } from "zod";

// Sometime ai response might be malformed, so I implemented this retry function to rerun review if it's not valid
export async function askOpenRouterWithValidation(
  messages: Message[],
  requestParams: Partial<ChatGenerationParams>,
  retries = 1,
): Promise<AiResponse> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await aiCall(messages, requestParams);
      return validateAiResponse(response);
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        if (attempt === retries) {
          console.error(
            "Max retries reached, AI keeps returning invalid response",
          );
          throw error;
        }
        console.warn(
          `Attempt ${attempt + 1}: invalid AI response, retrying...`,
        );
        console.warn("Zod issues:", error.issues);
      } else {
        console.error("Not a validation error, aborting retries");
        throw error;
      }
    }
  }

  throw new Error("Unexpected failure");
}
