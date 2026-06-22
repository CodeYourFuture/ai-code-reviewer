import {
  MODEL,
  //   removeAdditionalLineNumbers,
} from "../src/networks/ai/ai_api_request.js";

import { PRFile } from "../src/types/githubTypes.js";
import data from "../src/utils/sampleOutput/output2.json" with { type: "json" };
// import dataai from '../src/utils/sampleOutput/aiReviews/2026-03-29T12-24-00 add "if code is correct do not comment".json' with { type: "json" };
// import dataai from "/Users/cyf/Documents/Code/ai-code-reviewer/src/utils/sampleAiOutput/2026-03-29T10-38-26 rerun.json" with { type: "json" };
// import dataai from "/Users/cyf/Documents/Code/ai-code-reviewer/src/utils/sampleAiOutput/2026-06-01T10-50-41 new fixture.json" with { type: "json" };
// import dataai from "/Users/cyf/Documents/Code/ai-code-reviewer/manual-tests/sampleAiOutput/2026-06-07T14-59-25 finally separate the params.json" with { type: "json" };
import dataai from "/Users/cyf/Documents/Code/ai-code-reviewer/manual-tests/sampleAiOutput/2026-06-07T21-58-08 ,,,.json" with { type: "json" };
import { storeReview } from "../src/db/storeReview.js";
import { ReviewWithPrompt } from "../src/types/aiResponse.js";

const files: PRFile[] = data as PRFile[];
const commitSha = files[0].sha;
let review = dataai.review as ReviewWithPrompt[];

// review = review.map((r) => removeAdditionalLineNumbers(r));

if (commitSha) storeReview(review, MODEL, commitSha);
