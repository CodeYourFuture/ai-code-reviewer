import { Pool } from "pg";
import { env } from "../config/env.js";

const pool = new Pool({ connectionString: env.DATABASE_URL });

export async function assertDbConnection() {
  await pool
    .query("SELECT NOW()")
    .then(() => console.log("Connected to PostgreSQL!"));
}

export default pool;
