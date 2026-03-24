import { Pool } from "pg";
import { env } from "../config/env.js";

const pool = new Pool({
  user: env.DATABASE_USER,
  password: env.DATABASE_PASSWORD,
  database: env.DATABASE_NAME,
  connectionString: env.DATABASE_URL,
});

pool
  .query("SELECT NOW()")
  .then(() => console.log("Connected to PostgreSQL!"))
  .catch((err) => console.error("Connection error:", err));

export default pool;
