import fs from "node:fs";
import path from "path";
import { createInterface } from "readline";
import { FeedbackPoint } from "../types/aiResponse.js";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function formAiOutputDataObject(
  parameters: object,
  model: string,
  prompt: string,
  review: FeedbackPoint[],
) {
  const data = {
    parameters,
    prompt,
    model,
    review,
  };
  const name = await promptFileName();
  const dir = path.join(__dirname, "sampleAiOutput");

  fs.writeFileSync(
    path.join(dir, `${name}.json`),
    JSON.stringify(data, null, 2),
  );
}

async function promptFileName(): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question("Enter file name: ", (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}
