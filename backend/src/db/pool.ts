import { Pool, type PoolClient } from "pg";
import { logger } from "../middleware/logger";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 2_000,
});

pool.on("error", (err) => {
  logger.error("Unexpected PostgreSQL pool error", err);
});

export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
) {
  const start = Date.now();
  try {
    const res = await pool.query<T>(text, params);
    const duration = Date.now() - start;
    logger.debug("Executed query", { text, duration, rows: res.rowCount });
    return res;
  } catch (err) {
    logger.error("Query error", { text, params, err });
    throw err;
  }
}

export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function testConnection() {
  const client = await pool.connect();
  client.release();
  logger.info("PostgreSQL connection established");
}

export default pool;
