/**
 * esbuild `console` alias + inject.
 * Forwards each line to DevTools (`globalThis.console`) and `electron.log`.
 * Use `globalThis.console` in this file only — not the export — or logging recurses.
 */
declare const __MOD_ID__: string;

const native = globalThis.console;
const tag = `[${__MOD_ID__}]`;

type Level = "log" | "info" | "warn" | "error" | "debug";

function format(args: unknown[]): string {
  return args
    .map((value) => {
      if (typeof value === "string") return value;
      if (value instanceof Error) return value.stack ?? value.message;
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    })
    .join(" ");
}

function write(level: Level, args: unknown[]): void {
  native[level](tag, ...args);
  const log = electron?.log;
  if (typeof log !== "function") return;
  try {
    log(level === "log" ? "info" : level, __MOD_ID__, format(args));
  } catch {
    /* logging must never throw */
  }
}

/** Replaces bare `console` in bundled mod code (esbuild inject). */
export const console = {
  log: (...args: unknown[]) => write("log", args),
  info: (...args: unknown[]) => write("info", args),
  warn: (...args: unknown[]) => write("warn", args),
  error: (...args: unknown[]) => write("error", args),
  debug: (...args: unknown[]) => write("debug", args),
} as Console;
