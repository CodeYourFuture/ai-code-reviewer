import pool from "./db.js";

export async function storeGithubComment(
  pointId: number,
  commentId: number,
  commentUrl: string,
) {
  await pool.query(
    `UPDATE ai_feedback_points
     SET github_comment_id = $2, github_comment_url = $3
     WHERE id = $1 AND github_comment_id IS NULL`,
    [pointId, commentId, commentUrl],
  );
}
