import type { BuildTarget, PlatformTarget } from "./types";

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

export type LogCategory =
  | "BOOT"
  | "SDK"
  | "AUTH"
  | "SAVE"
  | "ADS"
  | "IAP"
  | "LEVEL"
  | "ECONOMY"
  | "META"
  | "ANALYTICS"
  | "NETWORK"
  | "LIVEOPS"
  | "A_B"
  | "PERF"
  | "ERROR";

export interface LogContext {
  sessionId: string;
  anonymousId: string;
  userId?: string;
  appVersion: string;
  buildTarget: BuildTarget;
  platformTarget: PlatformTarget;
  experiments?: Record<string, string>;
}

export interface LogRecord {
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  data?: Record<string, unknown>;
  context: LogContext;
}

export interface Logger {
  child(additional: Partial<LogContext>): Logger;
  trace(category: LogCategory, message: string, data?: Record<string, unknown>): void;
  debug(category: LogCategory, message: string, data?: Record<string, unknown>): void;
  info(category: LogCategory, message: string, data?: Record<string, unknown>): void;
  warn(category: LogCategory, message: string, data?: Record<string, unknown>): void;
  error(category: LogCategory, message: string, data?: Record<string, unknown>): void;
  fatal(category: LogCategory, message: string, data?: Record<string, unknown>): void;
  getContext(): LogContext;
}

export type LogSink = (record: LogRecord) => void;

const levelWeight: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

export function createConsoleLogSink(): LogSink {
  return (record) => {
    const output = JSON.stringify(record);
    const method =
      record.level === "error" || record.level === "fatal"
        ? console.error
        : record.level === "warn"
          ? console.warn
          : console.log;
    method(output);
  };
}

export function createLogger(
  context: LogContext,
  options?: {
    minLevel?: LogLevel;
    sinks?: LogSink[];
  },
): Logger {
  const minLevel = options?.minLevel ?? "info";
  const sinks = options?.sinks ?? [createConsoleLogSink()];

  const write = (
    level: LogLevel,
    category: LogCategory,
    message: string,
    data?: Record<string, unknown>,
  ) => {
    if (levelWeight[level] < levelWeight[minLevel]) {
      return;
    }

    const record: LogRecord = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      context,
    };
    if (data) {
      record.data = data;
    }

    for (const sink of sinks) {
      sink(record);
    }
  };

  return {
    child(additional) {
      return createLogger({ ...context, ...additional }, { minLevel, sinks });
    },
    trace: (category, message, data) => write("trace", category, message, data),
    debug: (category, message, data) => write("debug", category, message, data),
    info: (category, message, data) => write("info", category, message, data),
    warn: (category, message, data) => write("warn", category, message, data),
    error: (category, message, data) => write("error", category, message, data),
    fatal: (category, message, data) => write("fatal", category, message, data),
    getContext: () => context,
  };
}
