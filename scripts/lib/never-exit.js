/**
 * Keep a watch process alive after unexpected throws.
 * SIGINT / SIGTERM still stop the process (default Node handlers).
 *
 * @param {(message: string, err: unknown) => void} [log]
 */
export function installNeverExitHandlers(log = console.error) {
  process.on("uncaughtException", (err) => {
    log("uncaughtException — still watching", err);
  });
  process.on("unhandledRejection", (reason) => {
    log("unhandledRejection — still watching", reason);
  });
}

/**
 * @param {{
 *   stopping: boolean;
 *   restarting: boolean;
 *   signal: NodeJS.Signals | null;
 * }} opts
 * @returns {"exit" | "swap" | "respawn"}
 */
export function watchChildExitAction(opts) {
  if (opts.stopping) return "exit";
  if (opts.restarting) return "swap";
  if (opts.signal === "SIGINT" || opts.signal === "SIGTERM" || opts.signal === "SIGHUP") {
    return "exit";
  }
  return "respawn";
}

/** @param {number} previousMs */
export function nextRestartDelay(previousMs) {
  const start = previousMs > 0 ? previousMs : 250;
  return Math.min(start * 2, 10_000);
}
