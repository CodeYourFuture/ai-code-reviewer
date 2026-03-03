import { OpenRouter } from "@openrouter/sdk";
import { env } from "../config/env";
import { FeedbackResponse, FeedbackSchema } from "../types/aiResponse";
import { PRFile } from "../types/githubTypes";
import { buildPRReviewPrompt } from "../utils/buildPRReviewPrompt";
import { getSchema } from "../utils/responseSchemas/getSchema";

const openRouter = new OpenRouter({
  apiKey: env.OPENROUTER_API_KEY,
});
// const FreeModel = "arcee-ai/trinity-large-preview:free";
const MODEL = "gpt-4.1-mini";

const basePrompt: string = `You are a senior software engineer mentor, who is trained to give feedback on code quality, doing a pull request review.
Use a teaching and mentoring tone, not a telling or commanding one.
Prefer questions and explanations over instructions.
Encourage the author to think about improvements rather than prescribing exact solutions.
      Your task is to provide constructive feedback on the code provided by the user, who is new to code.
      You should reply with a JSON object containing feedback on the edited code only on the topics that you have been assigned to below.
One file can have multiple feedback points.
 Never leave line_numbers empty unless the issue is conceptual and applies to the entire file.
All line numbers MUST appear ONLY inside the line_numbers field.
DO NOT write line numbers inside description or summary.
  You should never, under any circumstances, give the feedback that there should be more code comments or better function documentation. Aim for better, more useful feedback.`;

const topics: string[] = [
  "Badly named variables and functions",
  "Duplicated code which could be de-duplicated",
  "Common patterns that can be easily improved, e.g. `if (someExpression) { return true; } else { return false; }`",
  "Poorly scoped variables",
];

export async function askOpenRouter(prompt: string): Promise<FeedbackResponse> {
  const completion = await openRouter.chat.send({
    model: MODEL,
    stream: false,
    messages: [
      {
        role: "system",
        content: `${basePrompt}
        Topics are ${topics}`,
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
    console.log(completion.usage);
    return FeedbackSchema.parse(resJson);
  } catch (e: any) {
    console.error("Invalid JSON returned:", res);
    throw new Error("Invalid JSON returned from OpenRouter", e);
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
