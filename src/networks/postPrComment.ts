import { Octokit } from "octokit";

export async function postPRComment(params: {
  owner: string;
  repo: string;
  pullNumber: number;
  body: string;
  octokit: Octokit;
}) {
  const { owner, repo, pullNumber, body, octokit } = params;

  await octokit.request(
    "POST /repos/{owner}/{repo}/issues/{issue_number}/comments",
    {
      owner,
      repo,
      issue_number: pullNumber,
      body,
      headers: {
        "x-github-api-version": "2022-11-28",
      },
    },
  );
}
