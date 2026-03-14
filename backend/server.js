import { app } from "./src/app.js";
import { env } from "./src/config/env.js";
import { logger } from "./src/config/logger.js";
import { prisma } from "./src/config/prisma.js";
import { captureException, flushSentry } from "./src/config/sentry.js";
import { assertSchemaCompatibility } from "./src/config/schemaGuard.js";

let server = null;

let shuttingDown = false;

const shutdown = async (signal, exitCode = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info({ signal }, "Graceful shutdown started");

  if (!server) {
    await prisma.$disconnect();
    await flushSentry();
    process.exit(exitCode);
    return;
  }

  server.close(async () => {
    await prisma.$disconnect();
    await flushSentry();
    process.exit(exitCode);
  });
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

process.on("unhandledRejection", (reason) => {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  logger.error({ err: error }, "Unhandled promise rejection");
  captureException(error, { type: "unhandledRejection" });
});

process.on("uncaughtException", (error) => {
  logger.fatal({ err: error }, "Uncaught exception");
  captureException(error, { type: "uncaughtException" });
  shutdown("uncaughtException", 1);
});

const bootstrap = async () => {
  await assertSchemaCompatibility();

  server = app.listen(env.port, () => {
    logger.info({ port: env.port, env: env.nodeEnv }, "Lensaya backend listening");
  });
};

bootstrap().catch(async (error) => {
  logger.fatal({ err: error }, "Server startup failed");
  captureException(error, { type: "startup" });
  await prisma.$disconnect();
  await flushSentry();
  process.exit(1);
});
