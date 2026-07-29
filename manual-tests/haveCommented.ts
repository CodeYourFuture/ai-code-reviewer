import { orgOctokit } from "../src/githubApp.js";
import { haveCommentedAlready } from "../src/networks/githubApi/haveCommentedAlready.js";
const owner = "CodeYourFuture";
const repo = "Module-Tools-Mirror-For-AI-Code-Reviewer-Testing";
const pullNumber = 12;

console.log(await haveCommentedAlready(owner, repo, pullNumber, orgOctokit));
