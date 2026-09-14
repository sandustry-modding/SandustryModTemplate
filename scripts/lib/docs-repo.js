/**
 * Clone sandustry-modding/sandustry-modding.github.io into docs/ when that folder is missing.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { styleText } from "./cli-style.js";

export const DOCS_REMOTE = "https://github.com/sandustry-modding/sandustry-modding.github.io.git";

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
 * @returns {string} Absolute `docs/` path
 */
export function ensureDocsRepo(repoRoot, deps = {}) {
  const dest = join(repoRoot, "docs");
  if (existsSync(join(dest, ".git"))) return dest;
  if (existsSync(dest)) {
    throw new Error(
      `docs/ exists but is not a git clone of ${DOCS_REMOTE}. Remove docs/ or clone that repository into docs/.`,
    );
  }

  console.log(styleText(["bold", "cyan"], "Cloning sandustry-modding.github.io into docs/"));
  const clone =
    deps.clone ?? ((args) => spawnSync("git", args, { cwd: repoRoot, stdio: "inherit" }));
  const result = clone(["clone", DOCS_REMOTE, "docs"]);
  if (cloneStatus(result) !== 0) {
    throw new Error(`Failed to clone ${DOCS_REMOTE} into docs/.`);
  }
  return dest;
}
