import { AiResponseWithId, ReviewWithPrompt } from "../types/aiResponse.js";
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
  const query = `
    INSERT INTO prompts (prompt)
    VALUES ($1)
    ON CONFLICT (prompt) DO UPDATE SET prompt = EXCLUDED.prompt
    RETURNING id
  `;

  const result = await pool.query(query, [prompt]);
  return result.rows[0].id;
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
  review: ReviewWithPrompt[],
  model: string,
  commit_sha: string,
): Promise<AiResponseWithId[]> => {
  const feedbackWithId: AiResponseWithId[] = [];

  for (let feedbackIndex = 0; feedbackIndex < review.length; feedbackIndex++) {
    const feedback = review[feedbackIndex];

    const prompt_id = await getOrCreatePromptId(feedback.prompt);
    const updatedPoints = [];

    for (const point of feedback.feedback_points) {
      const feedbackPointData: FeedbackPointData = {
        feedback_type: feedback.feedback_type,
        file_name: point.file_name,
        //TODO: save several topic if they are present, not only one
        review_topic: point.topic,
        point: point.point,
        // since ai can sometimes return array of numbers, despite of instructions, take only the first line number
        line_number: point.line_numbers[0],
        severity: point.severity,
        commit_sha,
        llm_model: model,
        prompt_id,
      };

      const feedbackPointId = await addFeedbackPoint(feedbackPointData);

      updatedPoints.push({
        ...point,
        point_id: feedbackPointId,
      });
    }

    feedbackWithId.push({
      feedback_type: feedback.feedback_type,
      feedback_points: updatedPoints,
    });
  }

  return feedbackWithId;
};
