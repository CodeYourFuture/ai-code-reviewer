import {
  MODEL,
  defaultChatParameters,
  runAiReview,
} from "../src/networks/ai/ai_api_request.js";
import { PRFile } from "../src/types/githubTypes.js";
import data from "../src/utils/sampleOutput/output2.json" with { type: "json" };
import { formAiOutputDataObject } from "./storeAiReviewData.js";

const files: PRFile[] = data as PRFile[];
const review = await runAiReview(files);
formAiOutputDataObject(defaultChatParameters, MODEL, review);
