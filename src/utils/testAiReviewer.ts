import { storeReview } from "../db/storeReview.js";
import {
  MODEL,
  codeQualityPrompt,
  commentQualityPrompt,
  defaultChatParameters,
  runAiReview,
} from "../networks/ai_api_request.js";
import { PRFile } from "../types/githubTypes.js";
import data from "../utils/sampleOutput/output2.json" with { type: "json" };
import { formAiOutputDataObject } from "./storeAiReviewData.js";

const files: PRFile[] = data as PRFile[];
const prompts = [codeQualityPrompt, commentQualityPrompt];
const review = await runAiReview(files);
formAiOutputDataObject(defaultChatParameters, MODEL, prompts, review);
storeReview();
