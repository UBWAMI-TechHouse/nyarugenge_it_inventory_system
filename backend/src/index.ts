import "dotenv/config";
import app from "./app";
import { testConnection } from "./db/pool";
import { logger } from "./middleware/logger";

const PORT = Number(process.env.PORT ?? 3000);

async function start() {
  try {
    await testConnection();
    app.listen(PORT, () => {
      logger.info(`🚀 Server running on http://localhost:${PORT}`);
      logger.info(`   Environment : ${process.env.NODE_ENV ?? "development"}`);
      logger.info(`   Health check: http://localhost:${PORT}/health`);
    });
  } catch (err) {
    logger.error("Failed to start server", err);
    process.exit(1);
  }
}

start();
