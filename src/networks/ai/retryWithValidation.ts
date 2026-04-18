import { AiResponse } from "../../types/aiResponse.js";
import { aiCall, validateAiResponse } from "../ai/ai_api_request.js";

export async function askOpenRouterWithValidation(
  code: string,
  reviewType: string,
  retries = 1,
): Promise<AiResponse> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await aiCall(code, reviewType);
      response;
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
