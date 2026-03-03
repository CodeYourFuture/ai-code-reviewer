import { Octokit } from "octokit";
import type { PRFile } from "../types/githubTypes";

/**
 * Function to get code from the PR
 */
export async function getPRFiles(
  owner: string,
  repo: string,
  pullNumber: number,
  octokit: Octokit,
): Promise<PRFile[]> {
  const res = await octokit.request(
    `GET /repos/${owner}/${repo}/pulls/${pullNumber}/files`,
    { per_page: 100 },
  );

  return res.data;
}

export async function logPRFiles(
  owner: string,
  repo: string,
  pullNumber: number,
  files: PRFile[],
) {
  console.log("\n📦 PR Info:", { owner, repo, pullNumber });
  console.log(`\n📂 Changed files (${files.length}):`);

  console.log("\nResponse ----------------------------------");
  console.log(`\n📂 Changed files (${JSON.stringify(files, null, 4)}):`);

  for (const file of files) {
    console.log("\n----------------------------------");
    console.log("File:", file.filename);

    if (file.patch) {
      console.log("Patch:\n", file.patch);
    } else {
      console.log("⚠️ No patch available");
    }
  }
}
