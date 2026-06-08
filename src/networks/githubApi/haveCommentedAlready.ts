import { Octokit } from "octokit";
import type { TimelineEvents } from "../../types/githubTypes.js";

export async function haveCommentedAlready(
  owner: string,
  repo: string,
  pullNumber: number,
  octokit: Octokit,
): Promise<boolean> {
  try {
    const events: TimelineEvents =
      await octokit.rest.issues.listEventsForTimeline({
        owner,
        repo,
        issue_number: pullNumber,
      });
    if (events.data) {
      const commentFromBotExist = events.data.some(
        (event) =>
          "user" in event && event.user?.login === "cyf-ai-code-reviewer[bot]",
      );
      return commentFromBotExist;
    }
    throw new Error("Error checking if bot has left a comment already");
  } catch (err) {
    throw err;
  }
}
