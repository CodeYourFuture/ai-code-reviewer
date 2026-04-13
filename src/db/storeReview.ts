import { AiResponse } from "../types/aiResponse.js";
import pool from "./db.js";

interface FeedbackPointData {
  feedback_type: string;
  file_name: string;
  review_topic: string;
  point: string;
  line_number: string;
  severity: number;
  commit_sha: string;
  llm_model?: string;
  prompt_id?: number;
}

export const getOrCreatePromptId = async (prompt: string): Promise<number> => {
  const selectQuery = "SELECT id FROM prompts WHERE prompt = $1 LIMIT 1";
  const insertQuery = "INSERT INTO prompts (prompt) VALUES ($1) RETURNING id";

  const selectResult = await pool.query(selectQuery, [prompt]);
  if (selectResult.rows.length > 0) {
    return selectResult.rows[0].id;
  }

  const insertResult = await pool.query(insertQuery, [prompt]);
  return insertResult.rows[0].id;
};

export const addFeedbackPoint = async (
  data: FeedbackPointData,
): Promise<number> => {
  const query = `INSERT INTO ai_feedback_points (feedback_type, file_name, review_topic, point, line_number, severity, commit_sha, llm_model, prompt_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`;

  const values = [
    data.feedback_type,
    data.file_name,
    data.review_topic,
    data.point,
    data.line_number,
    data.severity,
    data.commit_sha,
    data.llm_model || null,
    data.prompt_id || null,
  ];

  try {
    const result = await pool.query(query, values);
    console.log(`Feedback point added with ID: ${result.rows[0].id}`);
    return result.rows[0].id;
  } catch (error) {
    console.error("Error inserting feedback point:", error);
    throw error;
  }
};

export const storeReview = async (
  review: AiResponse[],
  model: string,
  commit_sha: string,
  prompts: string[],
) => {
  for (const feedback of review) {
    const feedbackIndex = review.indexOf(feedback);
    const prompt_id = await getOrCreatePromptId(prompts[feedbackIndex]);

    for (const point of feedback.feedback_points) {
      const feedbackPointData: FeedbackPointData = {
        feedback_type: feedback.feedback_type,
        file_name: point.file_name,
        review_topic: point.topics[0],
        point: point.point,
        line_number: point.line_numbers[0],
        severity: point.severity,
        commit_sha,
        llm_model: model,
        prompt_id,
      };

      await addFeedbackPoint(feedbackPointData);
    }
  }
};
