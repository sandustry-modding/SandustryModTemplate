#!/usr/bin/env node
/**
 * Watch src/examples (one mod).
 * Usage: npm run examples
 */
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { styleText } from "../lib/cli-style.js";
import { ensureExamplesRepo } from "../lib/examples-repo.js";
import { resolveDevCleanup } from "../lib/env.js";
import { removeAllDistContents, removeOwnedGameMods } from "../lib/mod-path.js";
import { pickDevModArgs } from "./pick-dev-mods.js";
import {
  installNeverExitHandlers,
  nextRestartDelay,
  watchChildExitAction,
} from "../lib/never-exit.js";

const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
installNeverExitHandlers((message, err) => {
  console.error(styleText("red", message), err);
});

ensureExamplesRepo(ROOT);
const extra = process.argv.slice(2);
const modArgs = await pickDevModArgs(["--mod", "examples", ...extra], { skipPicker: true });

console.log(styleText(["bold", "cyan"], "Watching src/examples"));

const esbuildScript = join(ROOT, "scripts/build/esbuild.config.mjs");

function spawnWatch() {
  return spawn(process.execPath, [esbuildScript, "--watch", ...modArgs], {
    stdio: "inherit",
    cwd: ROOT,
    windowsHide: true,
  });
}

let child = spawnWatch();
let stopping = false;
let cleaned = false;
let restartDelayMs = 250;
/** @type {ReturnType<typeof setTimeout> | undefined} */
let respawnTimer;

function cleanup() {
  if (cleaned) return;
  cleaned = true;
  const cleanupMode = resolveDevCleanup();
  if (cleanupMode === "off") return;
  try {
    if (cleanupMode === "all") removeAllDistContents(ROOT);
    else removeOwnedGameMods(ROOT);
  } catch (err) {
    console.error(
      styleText(
        "red",
        cleanupMode === "all" ? "Failed to clear dist/:" : "Failed to remove owned mods:",
      ),
      err,
    );
  }
}

function attachChild(proc) {
  proc.on("exit", (code, signal) => {
    const action = watchChildExitAction({
      stopping,
      restarting: false,
      signal,
    });
    if (action === "exit") {
      cleanup();
      process.exit(signal ? 0 : (code ?? 0));
      return;
    }
    const reason = code == null ? String(signal) : `code ${code}`;
    console.error(styleText("red", `esbuild watch exited (${reason}) — restarting`));
    clearTimeout(respawnTimer);
    respawnTimer = setTimeout(() => {
      if (stopping) return;
      restartDelayMs = nextRestartDelay(restartDelayMs);
      child = spawnWatch();
      attachChild(child);
    }, restartDelayMs);
  });
}

attachChild(child);

/** @param {NodeJS.Signals} signal */
function stop(signal) {
  if (stopping) return;
  stopping = true;
  clearTimeout(respawnTimer);
  if (!child.killed) child.kill(signal);
}

process.on("exit", cleanup);
process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));
process.on("SIGHUP", () => stop("SIGHUP"));
