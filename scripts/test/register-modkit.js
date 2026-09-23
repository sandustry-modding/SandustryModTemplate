/**
 * Resolve `@modkit/*` for `node --test`. Node does not use tsconfig paths.
 */
import { existsSync, statSync } from "node:fs";
import { registerHooks } from "node:module";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const MODKIT_DIR = join(ROOT, "modkit");

/**
 * @param {string} specifier
 * @returns {string | null}
 */
function resolveModkitSpecifier(specifier) {
  if (!specifier.startsWith("@modkit/")) return null;
  const rest = specifier.slice("@modkit/".length);
  if (!rest || rest.split("/").includes("..")) return null;
  const base = join(MODKIT_DIR, ...rest.split("/"));
  if (relative(MODKIT_DIR, base).startsWith("..")) return null;
  const files = [`${base}.ts`, `${base}.js`, join(base, "index.ts"), join(base, "index.js")];
  for (const file of files) {
    if (existsSync(file) && statSync(file).isFile()) return file;
  }
  return null;
}

/**
 * @param {string} specifier
 * @param {string} parentPath
 * @returns {string | null}
 */
function resolveModkitRelativeSpecifier(specifier, parentPath) {
  if (!specifier.startsWith(".") || !parentPath.startsWith(MODKIT_DIR)) return null;
  const resolved = join(dirname(parentPath), specifier);
  if (relative(MODKIT_DIR, resolved).startsWith("..")) return null;
  const files = [`${resolved}.ts`, `${resolved}.js`, join(resolved, "index.ts"), join(resolved, "index.js")];
  for (const file of files) {
    if (existsSync(file) && statSync(file).isFile()) return file;
  }
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    const file = resolveModkitSpecifier(specifier);
    if (file) return nextResolve(pathToFileURL(file).href, context);
    if (context.parentURL) {
      const parentPath = fileURLToPath(context.parentURL);
      const relativeFile = resolveModkitRelativeSpecifier(specifier, parentPath);
      if (relativeFile) return nextResolve(pathToFileURL(relativeFile).href, context);
    }
    return nextResolve(specifier, context);
  },
});
