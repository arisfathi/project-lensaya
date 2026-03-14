import pino from "pino";
import { env } from "./env.js";

const isDev = env.nodeEnv !== "production";

export const logger = pino({
  level: env.logLevel || "info",
  ...(isDev
    ? {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
          },
        },
      }
    : {}),
});
