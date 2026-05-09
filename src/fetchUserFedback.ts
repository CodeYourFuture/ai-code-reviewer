import pool from "./db/db.js";

export async function fetchFeedbackFromUser(userId: number, commentId: number) {
  const query =
    "SELECT ai_review_id, user_github_id FROM user_feedback WHERE user_github_id = $1 AND ai_review_id = $2";

  const values = [userId, commentId];

  const result = await pool.query(query, values);
  console.log(result.rows);
  return result.rows[0];
}
