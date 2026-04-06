// import {
//   MODEL,
//   removeAdditionalLineNumbers,
// } from "../networks/ai_api_request.js";
// import {
//   basePrompt,
//   badCommentsPrompt,
//   topics,
// } from "../networks/ai/prompt.js";
// import { PRFile } from "../types/githubTypes.js";
// import data from "../utils/sampleOutput/output2.json" with { type: "json" };
// // import dataai from '../utils/sampleOutput/aiReviews/2026-03-29T12-24-00 add "if code is correct do not comment".json' with { type: "json" };
// import dataai from "/Users/cyf/Documents/Code/ai-code-reviewer/src/utils/sampleAiOutput/2026-03-29T10-38-26 rerun.json" with { type: "json" };
// import { storeReview } from "../db/storeReview.js";

// const files: PRFile[] = data as PRFile[];
// const commitSha = files[0].sha;
// const prompts = [basePrompt, badCommentsPrompt];
// const topicsList = [topics];
// let review = dataai.review as Array<{
//   feedback_type: "code quality" | "comments quality";
//   feedback_points: {
//     file_name: string;
//     topics: string[];
//     summary: string;
//     point: string;
//     line_numbers: string[];
//     severity: number;
//   }[];
// }>;

// review = review.map((r) => removeAdditionalLineNumbers(r));

// if (commitSha) storeReview(review, MODEL, commitSha, prompts, topicsList);
