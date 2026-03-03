import fs from "node:fs";
import { Octokit } from "octokit";
import { getPRFiles, logPRFiles } from "../networks/github";

export function parsePRUrl(url: string) {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);

  if (!match) {
    throw new Error("Invalid GitHub PR URL");
  }

  return {
    owner: match[1],
    repo: match[2],
    pullNumber: Number(match[3]),
  };
}

async function run(prUrl: string) {
  const { owner, repo, pullNumber } = parsePRUrl(prUrl);
  const octokit = new Octokit();
  const res = await getPRFiles(owner, repo, pullNumber, octokit);
  logPRFiles(owner, repo, pullNumber, res);
  fs.writeFileSync(`output${pullNumber}.json`, JSON.stringify(res, null, 2));
}

const prUrl = process.argv[2];

if (!prUrl) {
  console.error("Usage: npx tsx src/utils/fetchAndStore.ts <PR_URL>");
  process.exit(1);
}

run(prUrl).catch(console.error);
