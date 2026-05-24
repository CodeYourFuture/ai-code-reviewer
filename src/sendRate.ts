import pool from "./db/db.js";
import { actionTypes } from "./types/dbTypes.js";

export async function rateFeedback(
  id: number,
  action: actionTypes,
  userId: number,
  nickname: string,
) {
  const query = `INSERT INTO users_feedback (ai_review_id, user_github_id, username_github, user_feedback) VALUES ($1, $2, $3, $4) RETURNING id`;

  const values = [id, userId, nickname, action];

  const result = await pool.query(query, values);
  console.log(`user's Feedback added with ID: ${result.rows[0].id}`);
  return result.rows[0].id;
}
