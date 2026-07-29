import { Octokit } from "octokit";
import type { TimelineEventsData } from "../../types/githubTypes.js";
import { fetchAllPrEvents } from "./fetchAllPrEvents.js";

export async function haveCommentedAlready(
  owner: string,
  repo: string,
  pullNumber: number,
  octokit: Octokit,
): Promise<boolean> {
  try {
    const events: TimelineEventsData = await fetchAllPrEvents(
      owner,
      repo,
      pullNumber,
      octokit,
    );

    const commentFromBotExist = events.some(
      (event) =>
        "actor" in event && event.actor?.login === "cyf-ai-code-reviewer[bot]",
    );
    return commentFromBotExist;
  } catch (err) {
    console.error("Error checking if bot has left a comment already", err);
    throw err;
  }
}
