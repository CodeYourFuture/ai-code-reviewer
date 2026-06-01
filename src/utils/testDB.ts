// import {
//   MODEL,
//   //   removeAdditionalLineNumbers,
// } from "../networks/ai/ai_api_request.js";

// import { PRFile } from "../types/githubTypes.js";
// import data from "../utils/sampleOutput/output2.json" with { type: "json" };
// // import dataai from '../utils/sampleOutput/aiReviews/2026-03-29T12-24-00 add "if code is correct do not comment".json' with { type: "json" };
// // import dataai from "/Users/cyf/Documents/Code/ai-code-reviewer/src/utils/sampleAiOutput/2026-03-29T10-38-26 rerun.json" with { type: "json" };
// import dataai from "/Users/cyf/Documents/Code/ai-code-reviewer/src/utils/sampleAiOutput/2026-06-01T10-50-41 new fixture.json" with { type: "json" };
// import { storeReview } from "../db/storeReview.js";
// import { ReviewWithPrompt } from "../types/aiResponse.js";

// const files: PRFile[] = data as PRFile[];
// const commitSha = files[0].sha;
// let review = dataai.review as ReviewWithPrompt[];

// // review = review.map((r) => removeAdditionalLineNumbers(r));

// if (commitSha) storeReview(review, MODEL, commitSha);
