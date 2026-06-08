import { Octokit } from "octokit";
import type { TimelineEvents } from "../../types/githubTypes.js";

export async function haveCommentedAlready(
  owner: string,
  repo: string,
  pullNumber: number,
  octokit: Octokit,
) {
  try {
    const events: TimelineEvents =
      await octokit.rest.issues.listEventsForTimeline({
        owner,
        repo,
        issue_number: pullNumber,
      });

    if (events.data) {
      const commentFromBot = events.data.find((event) => {
        event.actor?.login === "cyf-ai-code-reviewer[bot]";
      });
      if (commentFromBot) {
        return true;
      } else {
        false;
      }
    }
  } catch (err) {
    throw err;
  }
}
