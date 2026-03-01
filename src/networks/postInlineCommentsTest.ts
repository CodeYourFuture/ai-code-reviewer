//TEST
//This is how I check that this function construct proper request to post inline comments
// TODO: write better tests, so that I don't have to trigger api
import { octokit } from "../testApp";
import aiReview from "../utils/sampleOutput/aiReviews/11list.json";
import { postInlineComments } from "./postInlineComment";

const owner = "Droid-An";
const repo = "Module-Data-Flows";
const pullNumber = 1;
const commitId = "2f6b58694bad52e2e721c3c94f44a6ccfbe92dec";
for (const point of aiReview.feedback_points) {
  postInlineComments(owner, repo, pullNumber, octokit, point, commitId);
}
