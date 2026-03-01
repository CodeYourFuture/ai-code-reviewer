// this is file for isolated testing. WIP
import { runAiReview } from "../networks/openai_api_request";
import { PRFile } from "../types/githubTypes";
import data from "../utils/sampleOutput/output152.json";

const files: PRFile[] = data as PRFile[];
await runAiReview(files);
