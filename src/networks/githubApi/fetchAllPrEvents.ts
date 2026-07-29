import type { Octokit } from "octokit";
import type { TimelineEventsData } from "../../types/githubTypes.js";

export async function fetchAllPrEvents(
  owner: string,
  repo: string,
  pullNumber: number,
  octokit: Octokit,
): Promise<TimelineEventsData> {
  const all: TimelineEventsData = [];
  for (let page = 1; ; page++) {
    const { data: batch } = await octokit.rest.issues.listEventsForTimeline({
      owner,
      repo,
      issue_number: pullNumber,
      page: page,
      per_page: 100,
    });
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all;
}
