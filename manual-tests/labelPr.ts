import { orgOctokit } from "../src/githubApp.js";
import {
  removeLabelFromPR,
  addLabelToPR,
} from "../src/networks/githubApi/handleLabels.js";

if (!orgOctokit) throw new Error("This script requires NODE_ENV=production and an organization installation");
const owner = "CodeYourFuture";
const repo = "Module-Tools-Mirror-For-AI-Code-Reviewer-Testing";
const pullNumber = 12;

await removeLabelFromPR(orgOctokit, owner, repo, pullNumber, "Needs Review");
await addLabelToPR(orgOctokit, owner, repo, pullNumber, "Reviewed");
