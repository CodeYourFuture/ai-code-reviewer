import pool from "./db/db.js";
interface row {
  ai_review_id: number;
  user_github_id: number;
}

export async function fetchFeedbackFromUser(
  userId: number,
  commentId: number,
): Promise<row[]> {
  const query =
    "SELECT ai_review_id, user_github_id FROM users_feedback WHERE user_github_id = $1 AND ai_review_id = $2";

  const values = [userId, commentId];

  const result = await pool.query(query, values);
  console.log(result.rows);
  return result.rows;
}
