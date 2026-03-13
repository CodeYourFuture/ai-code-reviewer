import { Octokit } from "octokit";
// import { octokit } from "./testApp.js";
export async function checkMembershipForUser(
  senderLogin: string,
  octokit: Octokit,
) {
  const orgName = "CodeYourFuture";
  try {
    await octokit.request("GET /orgs/{org}/members/{username}", {
      org: orgName,
      username: senderLogin,
    });
    return true;
  } catch (err: any) {
    if (err.status === 404) return false;
  }
}
//command to see if user droid-an is a member of codeyourfuture
// console.log(await checkMembershipForUser("Droid-An", octokit));
