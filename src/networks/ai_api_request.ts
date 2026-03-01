import { OpenRouter } from "@openrouter/sdk";
import { env } from "../config/env";
import { FeedbackResponse, FeedbackSchema } from "../types/aiResponse";
import { PRFile } from "../types/githubTypes";
import { buildPRReviewPrompt } from "../utils/buildPRReviewPrompt";
import { getSchema } from "../utils/responseSchemas/getSchema";

const openRouter = new OpenRouter({
  apiKey: env.OPENROUTER_API_KEY,
});

export async function askOpenRouter(prompt: string): Promise<FeedbackResponse> {
  const completion = await openRouter.chat.send({
    model: "arcee-ai/trinity-large-preview:free",
    stream: false,
    messages: [
      {
        role: "system",
        //TODO: change prompt
        content: `You are a senior software engineer doing a pull request review. Be concise, actionable, and point out risks, bugs, and improvements. 
        One file can have multiple feedback points.
          When providing feedback, always include exact line ranges from the provided line-numbered diff. Never leave line_ranges empty unless the issue is conceptual and applies to the entire file.`,
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    responseFormat: {
      type: "json_schema",
      jsonSchema: getSchema,
    },
  });

  const res = completion.choices[0]?.message?.content;
  if (!res) {
    throw new Error("No content returned from OpenRouter");
  }
  if (typeof res !== "string") {
    throw new Error("Content returned from OpenRouter is not string");
  }
  try {
    const resJson = JSON.parse(res);
    return FeedbackSchema.parse(resJson);
  } catch {
    throw new Error("Invalid JSON returned from OpenRouter");
  }
}

export async function runAiReview(files: PRFile[]) {
  const prompt = buildPRReviewPrompt({
    files,
  });
  console.log("--------- PROMPT --------\n", prompt);
  console.log("\n🤖 Sending PR diff to OpenRouter for review...\n");

  const review = await askOpenRouter(prompt);

  console.log("\n================ PR REVIEW ================\n");
  console.log(review);
  console.log("\n==========================================\n");

  return review;
}
