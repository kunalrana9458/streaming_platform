import pino from "pino";

const level =
  process.env.LOG_LEVEL ||
  (process.env.NODE_ENV === "production" ? "info" : "debug");

const transport = pino.transport({
  targets: [
    // 1. Output to Console (for you to see)
    {
      target: 'pino-pretty',
      options: { colorize: true },
      level: 'info',
    },
    // 2. Output to File (for storage)
    {
      target: 'pino/file',
      options: { destination: './logs/app.log', mkdir: true },
      level: 'info',
    }
  ]
});

const logger = pino(transport);
export default logger;
