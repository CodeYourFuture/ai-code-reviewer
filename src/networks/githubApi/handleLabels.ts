import type { Octokit } from "octokit";

/**
 * Adds a label to a pull request.
 *
 * Note: PRs are "issues" under the hood in the GitHub REST API, so labels are
 * managed via the issues endpoints even when the target is a PR.
 *
 * Idempotent — if the label is already on the PR, GitHub just leaves it as-is
 * and this resolves without error.
 */
export async function addLabelToPR(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
  label: string,
): Promise<void> {
  try {
    await octokit.rest.issues.addLabels({
      owner,
      repo,
      issue_number: prNumber,
      labels: [label],
    });
  } catch (error: any) {
    console.error("Error labeling prs", error);
  }
}

/**
 * Removes a label from a pull request.
 *
 * Safe to call even if the label isn't currently present — GitHub returns a
 * 404 in that case, which is caught and swallowed here so callers don't need
 * to check first.
 */
export async function removeLabelFromPR(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
  label: string,
): Promise<void> {
  try {
    await octokit.rest.issues.removeLabel({
      owner,
      repo,
      issue_number: prNumber,
      name: label,
    });
  } catch (error: any) {
    if (error?.status === 404) {
      // Label wasn't on the PR — nothing to do.
      return;
    }
    console.error("Error removing label", error);
    throw error;
  }
}
