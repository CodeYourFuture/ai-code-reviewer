import {
  MODEL,
  codeQualityPrompt,
  commentQualityPrompt,
  defaultChatParameters,
  // removeAdditionalLineNumbers,
  runAiReview,
} from "../networks/ai_api_request.js";
import { PRFile } from "../types/githubTypes.js";
import data from "../utils/sampleOutput/output408.json" with { type: "json" };
// import dataai from "../utils/sampleAiOutput/2026-03-28T18-33-48 don't ask is that what you want questions.json" with { type: "json" };
// import { buildReviewCommentsArray } from "./commentsToList.js";

import { formAiOutputDataObject } from "./storeAiReviewData.js";
// import { AiResponse } from "../types/aiResponse.js";

const files: PRFile[] = data as PRFile[];
const prompts = [codeQualityPrompt, commentQualityPrompt];
const review = await runAiReview(files);
// const review1 = dataai.review;
// review1.forEach((review) => removeAdditionalLineNumbers(review));
// console.log(JSON.stringify(review1, null, 2));

// const coommentReview = review1.filter(
//   (expert) => (expert.feedback_type = "comments quality"),
// );
// const points = coommentReview[0].feedback_points;
// console.log(buildReviewCommentsArray(points));
formAiOutputDataObject(defaultChatParameters, MODEL, prompts, review);
