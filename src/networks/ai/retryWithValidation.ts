import { Message } from "@openrouter/sdk/models";
import { AiResponse } from "../../types/aiResponse.js";
import { aiCall, validateAiResponse } from "../ai/ai_api_request.js";

// Sometime ai response might be malformed, so I implemented this retry function to rerun review if it's not valid
export async function askOpenRouterWithValidation(
  messages: Message[],
  retries = 1,
): Promise<AiResponse> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await aiCall(messages);
      return validateAiResponse(response);
    } catch (error: any) {
      if (attempt === retries) {
        throw error;
      }

      console.log(`Invalid JSON returned, retrying AI request...`);
    }
  }

  throw new Error("Unexpected failure");
}
