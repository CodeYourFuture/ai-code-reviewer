import { FeedbackResponse } from "../../types/aiResponse.js";
import { aiCall, validateFeedbackResponse } from "../ai_api_request.js";

export async function retryWithValidation(
  prompt: string,
  retries = 1,
): Promise<FeedbackResponse> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await aiCall(prompt);
      return validateFeedbackResponse(response);
    } catch (error: any) {
      if (attempt === retries) {
        throw error;
      }

      console.log(`Invalid JSON returned, retrying AI request...`);
    }
  }

  throw new Error("Unexpected failure");
}
