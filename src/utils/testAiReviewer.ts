import { basePrompt, topics } from "../networks/ai/prompt.js";
import { MODEL, parameters, runAiReview } from "../networks/ai_api_request.js";
import { PRFile } from "../types/githubTypes.js";
import data from "../utils/sampleOutput/output2.json" with { type: "json" };
import { formAiOutputDataObject } from "./storeAiReviewData.js";

const files: PRFile[] = data as PRFile[];
const prompt = `${basePrompt}
        Topics are: \n- ${topics.join(`\n- `)}`;
const review = await runAiReview(files);
formAiOutputDataObject(parameters, MODEL, prompt, review);
