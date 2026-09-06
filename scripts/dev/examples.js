#!/usr/bin/env node
/**
 * Watch every examples/<name>/ mod (no TTY picker).
 * Usage: npm run examples [-- --mod overlay-hotkey]
 */
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { styleText } from "../lib/cli-style.js";
import { ensureExamplesRepo } from "../lib/examples-repo.js";
import { resolveDevCleanup } from "../lib/env.js";
import { removeAllDistContents, removeOwnedGameMods } from "../lib/mod-path.js";
import { pickDevModArgs } from "./pick-dev-mods.js";

const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
ensureExamplesRepo(ROOT);
const extra = ["--examples", ...process.argv.slice(2)];
const modArgs = await pickDevModArgs(extra, { skipPicker: true, roots: ["examples"] });

console.log(styleText(["bold", "cyan"], "Watching examples/ mods"));

const child = spawn(
  process.execPath,
  [join(ROOT, "scripts/build/esbuild.config.mjs"), "--watch", ...modArgs, ...extra],
  {
    stdio: "inherit",
    cwd: ROOT,
    windowsHide: true,
  },
);

let stopping = false;
let cleaned = false;

function cleanup() {
  if (cleaned) return;
  cleaned = true;
  const cleanup = resolveDevCleanup();
  if (cleanup === "off") return;
  try {
    if (cleanup === "all") removeAllDistContents(ROOT);
    else removeOwnedGameMods(ROOT);
  } catch (err) {
    console.error(
      styleText("red", cleanup === "all" ? "Failed to clear dist/:" : "Failed to remove owned mods:"),
      err,
    );
  }
}

/** @param {NodeJS.Signals} signal */
function stop(signal) {
  if (stopping) return;
  stopping = true;
  if (!child.killed) child.kill(signal);
}

child.on("exit", (code, signal) => {
  cleanup();
  if (signal) process.exit(0);
  process.exit(code ?? 0);
});

process.on("exit", cleanup);
process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));
process.on("SIGHUP", () => stop("SIGHUP"));
