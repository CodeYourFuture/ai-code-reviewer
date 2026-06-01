import { Octokit } from "octokit";
import { orgOctokit } from "./githubApp.js";
import { AutoCleanupCache as TTLCache } from "./ttlCache.js";

const orgName = "CodeYourFuture";

const membershipCache = new TTLCache<string, boolean>(600000);

export async function checkMembershipForUser(
  senderLogin: string,
  octokit: Octokit = orgOctokit,
) {
  const cached = membershipCache.get(senderLogin);
  if (cached !== undefined) {
    return cached;
  }
  try {
    const res = await octokit.request("GET /orgs/{org}/members/{username}", {
      org: orgName,
      username: senderLogin,
    });
    if (res.status === 302) {
      // 302 = requester (octokit instance in this case) is not an org member, so membership can't be confirmed
      membershipCache.set(senderLogin, false);
      return false;
    }
    const isMember = res.status === 204;
    membershipCache.set(senderLogin, isMember);
    return isMember;
  } catch (error: any) {
    console.log(error);
    if (error.status === 404) {
      membershipCache.set(senderLogin, false);
      return false;
    }
    throw error;
  }
}
