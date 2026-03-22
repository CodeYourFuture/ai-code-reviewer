import fs from "node:fs";
import path from "path";
import { createInterface } from "readline";
import { fileURLToPath } from "url";
import { FeedbackPoint } from "../types/aiResponse.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function formAiOutputDataObject(
  parameters: object,
  model: string,
  prompt: string[],
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
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  try {
    fs.writeFileSync(
      path.join(dir, `${timestamp} ${name}.json`),
      JSON.stringify(data, null, 2),
    );
  } catch (e) {
    console.log(e);
    fs.writeFileSync(
      path.join(`${timestamp} ${name}.json`),
      JSON.stringify(data, null, 2),
    );
  }
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
