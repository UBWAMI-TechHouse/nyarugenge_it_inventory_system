import winston from "winston";
import morgan from "morgan";
import type { Request, Response, NextFunction } from "express";

const { combine, timestamp, printf, colorize, errors } = winston.format;

const devFormat = combine(
  colorize(),
  timestamp({ format: "HH:mm:ss" }),
  errors({ stack: true }),
  printf(({ level, message, timestamp, stack }) =>
    stack
      ? `${timestamp} ${level}: ${message}\n${stack}`
      : `${timestamp} ${level}: ${message}`
  )
);

const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  winston.format.json()
);

export const logger = winston.createLogger({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  format: process.env.NODE_ENV === "production" ? prodFormat : devFormat,
  transports: [
    new winston.transports.Console(),
    ...(process.env.NODE_ENV === "production"
      ? [
          new winston.transports.File({ filename: "logs/error.log", level: "error" }),
          new winston.transports.File({ filename: "logs/combined.log" }),
        ]
      : []),
  ],
});

// HTTP request logger using morgan
export const httpLogger = morgan(
  process.env.NODE_ENV === "production" ? "combined" : "dev",
  {
    stream: {
      write: (message: string) => logger.http(message.trim()),
    },
    skip: (_req: Request, res: Response) =>
      process.env.NODE_ENV === "production" && res.statusCode < 400,
  }
);

// Generic error-logging middleware (attach after routes)
export function errorLogger(
  err: Error,
  _req: Request,
  _res: Response,
  next: NextFunction
) {
  logger.error(err.message, { stack: err.stack });
  next(err);
}
