import { runAiReview } from "../networks/ai_api_request.js";
import { PRFile } from "../types/githubTypes.js";
import data from "../utils/sampleOutput/output2.json" with { type: "json" };

const files: PRFile[] = data as PRFile[];
await runAiReview(files);
