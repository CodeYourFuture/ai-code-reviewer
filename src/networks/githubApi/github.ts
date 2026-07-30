import { Octokit } from "octokit";
import type { PRFile } from "../../types/githubTypes.js";

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
