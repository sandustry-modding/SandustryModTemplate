/**
 * Clone sandustry-modding/SandustryExamples into src/examples when that folder is missing.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { styleText } from "./cli-style.js";

export const EXAMPLES_REMOTE = "https://github.com/sandustry-modding/SandustryExamples.git";
export const EXAMPLES_DIR = join("src", "examples");

/**
 * @param {{ status?: number | null }} result
 * @returns {number}
 */
function cloneStatus(result) {
  return result.status ?? 1;
}

/**
 * @param {string} repoRoot Template repository root
 * @param {{ clone?: (args: string[]) => { status?: number | null } }} [deps]
 * @returns {string} Absolute `src/examples` path
 */
export function ensureExamplesRepo(repoRoot, deps = {}) {
  const dest = join(repoRoot, EXAMPLES_DIR);
  if (existsSync(join(dest, ".git"))) return dest;
  if (existsSync(dest)) {
    throw new Error(
      `${EXAMPLES_DIR} exists but is not a git clone of ${EXAMPLES_REMOTE}. Remove ${EXAMPLES_DIR} or clone that repository into ${EXAMPLES_DIR}.`,
    );
  }

  console.log(styleText(["bold", "cyan"], `Cloning SandustryExamples into ${EXAMPLES_DIR}`));
  const clone =
    deps.clone ?? ((args) => spawnSync("git", args, { cwd: repoRoot, stdio: "inherit" }));
  const result = clone(["clone", EXAMPLES_REMOTE, EXAMPLES_DIR]);
  if (cloneStatus(result) !== 0) {
    throw new Error(`Failed to clone ${EXAMPLES_REMOTE} into ${EXAMPLES_DIR}.`);
  }
  return dest;
}
