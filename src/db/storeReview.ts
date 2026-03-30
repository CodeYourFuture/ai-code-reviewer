import pool from "./db.js";

export const storeReview = async () => {
  pool.query(
    "UPDATE users SET name = $1, email = $2 WHERE id = $3",
    [aiReview, sha, model, promptId, reviewTopicsId],
    (error, results) => {
      if (error) {
        throw error;
      }
      console.log(`User added with ID: ${results.rows[0].id}`);
    },
  );
};
