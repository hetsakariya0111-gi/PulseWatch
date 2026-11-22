/**
 * Minimal structured logger.
 *
 * Deliberately dependency-free: log aggregators (Vercel, Datadog, ...) consume
 * newline-delimited JSON, and this keeps the serverless bundle small. Swap
 * `emit` for pino later if we need transports or sampling.
 *
 * Usage:
 *   logger.info("monitor checked", { monitorId, statusCode, durationMs });
 *   const log = logger.child({ requestId });
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_WEIGHT: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export type LogContext = Record<string, unknown>;

function resolveMinLevel(): LogLevel {
  const configured = process.env.LOG_LEVEL;
  if (configured === "debug" || configured === "info" || configured === "warn" || configured === "error") {
    return configured;
  }
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

const minLevel = resolveMinLevel();
const isProduction = process.env.NODE_ENV === "production";

function emit(level: LogLevel, message: string, context?: LogContext): void {
  if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[minLevel]) return;

  const time = new Date().toISOString();

  if (isProduction) {
    // One JSON object per line — machine readable.
    const line = JSON.stringify({ level, time, msg: message, ...context });
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
    return;
  }

  // Human readable in development.
  const prefix = `[${time}] ${level.toUpperCase().padEnd(5)} ${message}`;
  const hasContext = context !== undefined && Object.keys(context).length > 0;
  if (level === "error") console.error(prefix, hasContext ? context : "");
  else if (level === "warn") console.warn(prefix, hasContext ? context : "");
  else console.log(prefix, hasContext ? context : "");
}

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  /** Derives a logger that always includes `base` in every log line. */
  child(base: LogContext): Logger;
}

function createLogger(base: LogContext): Logger {
  const merge = (context?: LogContext): LogContext => ({ ...base, ...context });
  return {
    debug: (message, context) => emit("debug", message, merge(context)),
    info: (message, context) => emit("info", message, merge(context)),
    warn: (message, context) => emit("warn", message, merge(context)),
    error: (message, context) => emit("error", message, merge(context)),
    child: (childBase) => createLogger({ ...base, ...childBase }),
  };
}

export const logger = createLogger({});
