import type { Octokit } from "octokit";
import { AutoCleanupCache as TTLCache } from "../../utils/ttlCache.js";

const membershipCache = new TTLCache<string, boolean>(600000);

export async function checkMembershipForUser(
  senderLogin: string,
  octokit: Octokit,
  orgName: string,
) {
  const cacheKey = `${orgName.toLowerCase()}/${senderLogin.toLowerCase()}`;
  const cached = membershipCache.get(cacheKey);
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
      membershipCache.set(cacheKey, false);
      return false;
    }
    const isMember = res.status === 204;
    membershipCache.set(cacheKey, isMember);
    return isMember;
  } catch (error: any) {
    if (error.status === 404) {
      membershipCache.set(cacheKey, false);
      return false;
    }
    console.log(error);
    throw error;
  }
}

export function _clearMembershipCacheForTests() {
  membershipCache.destroy();
}
