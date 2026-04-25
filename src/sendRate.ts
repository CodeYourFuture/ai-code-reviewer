import pool from "./db/db.js";
import { actionTypes } from "./types/dbTypes.js";

export async function rateFeedback(id: number, action: actionTypes) {
  const query = `INSERT INTO user_feedback (ai_review_id, username_github, user_feedback) VALUES ($1, $2, $3) RETURNING id`;
  //TODO: replace placeholder user value
  const values = [id, "Droid_An", action];

  try {
    const result = await pool.query(query, values);
    console.log(`user's Feedback added with ID: ${result.rows[0].id}`);
    return result.rows[0].id;
  } catch (error) {
    console.error("Error inserting feedback:", error);
    throw error;
  }
}
