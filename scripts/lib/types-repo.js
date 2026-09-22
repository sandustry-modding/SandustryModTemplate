/**
 * Clone sandustry-modding/SandustryTypes into SandustryTypes/ when that folder is missing.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { styleText } from "./cli-style.js";

export const TYPES_REMOTE = "https://github.com/sandustry-modding/SandustryTypes.git";
export const TYPES_DIR = "SandustryTypes";
const DEFAULT_BRANCH = "main";

/**
 * @param {string} repoRoot Template repository root
 * @returns {string}
 */
export function typesRepoPath(repoRoot) {
  return join(repoRoot, TYPES_DIR);
}

/**
 * @param {{ status?: number | null }} result
 * @returns {number}
 */
function gitStatus(result) {
  return result.status ?? 1;
}

/**
 * @param {string} repoRoot Template repository root
 * @param {{ clone?: (args: string[]) => { status?: number | null } }} [deps]
 * @returns {string} Absolute `SandustryTypes/` path
 */
export function ensureTypesRepo(repoRoot, deps = {}) {
  const dest = typesRepoPath(repoRoot);
  if (existsSync(join(dest, ".git"))) return dest;
  if (existsSync(dest)) {
    throw new Error(
      `${TYPES_DIR}/ exists but is not a git clone of ${TYPES_REMOTE}. Remove ${TYPES_DIR}/ or clone that repository into ${TYPES_DIR}/.`,
    );
  }

  console.log(styleText(["bold", "cyan"], `Cloning SandustryTypes into ${TYPES_DIR}/`));
  const clone =
    deps.clone ?? ((args) => spawnSync("git", args, { cwd: repoRoot, stdio: "inherit" }));
  const result = clone(["clone", TYPES_REMOTE, TYPES_DIR]);
  if (gitStatus(result) !== 0) {
    throw new Error(`Failed to clone ${TYPES_REMOTE} into ${TYPES_DIR}/.`);
  }
  return dest;
}

/**
 * Fast-forward the local types clone to the latest `main` on GitHub.
 *
 * @param {string} repoRoot Template repository root
 * @param {{ run?: (args: string[], opts: { cwd: string }) => { status?: number | null } }} [deps]
 * @returns {{ ok: boolean, message?: string }}
 */
export function syncTypesRepo(repoRoot, deps = {}) {
  const dest = typesRepoPath(repoRoot);
  if (!existsSync(join(dest, ".git"))) {
    return { ok: false, message: `${TYPES_DIR}/ is not a git clone` };
  }

  const run =
    deps.run ??
    ((args, opts) => spawnSync("git", args, { cwd: opts.cwd, stdio: "pipe", encoding: "utf8" }));

  const fetch = run(["fetch", "origin"], { cwd: dest });
  if (gitStatus(fetch) !== 0) {
    const stderr = typeof fetch.stderr === "string" ? fetch.stderr.trim() : "";
    return { ok: false, message: stderr || "git fetch failed" };
  }

  const pull = run(["pull", "--ff-only", "origin", DEFAULT_BRANCH], { cwd: dest });
  if (gitStatus(pull) !== 0) {
    const stderr = typeof pull.stderr === "string" ? pull.stderr.trim() : "";
    return { ok: false, message: stderr || "git pull failed" };
  }

  return { ok: true };
}
