import { basename, normalize, sep } from "node:path";

const NODE_MODULES = `${sep}node_modules${sep}`;

/**
 * True when a resolved source file is a simulation worker module (`worker.ts` or `*.worker.ts`).
 * @param {string} filePath
 */
export function isWorkerModulePath(filePath) {
  const path = normalize(filePath);
  if (path.includes(NODE_MODULES)) return false;
  const name = basename(path);
  return /^worker\.[cm]?tsx?$/.test(name) || /\.worker\.[cm]?tsx?$/.test(name);
}

/**
 * Heuristic on bare import specifiers before resolve (avoids resolving every module).
 * @param {string} specifier
 */
function mightImportWorkerModule(specifier) {
  if (specifier.includes("node_modules")) return false;
  if (specifier.includes("?worker-text")) return false;
  return /(?:^|[/\\])worker(?:\.[cm]?tsx?)?(?:\?.*)?$|\.worker\.[cm]?tsx?(?:\?.*)?$/u.test(
    specifier,
  );
}

/**
 * Fail the main bundle when it pulls in worker-only modules.
 * Worker bundles may import `worker.ts` / `*.worker.ts`.
 */
export function blockMainWorkerImportsPlugin() {
  return {
    name: "block-main-worker-imports",
    setup(build) {
      build.onResolve({ filter: /.*/ }, async (args) => {
        if (args.namespace !== "file") return;
        if (!mightImportWorkerModule(args.path)) return;

        const result = await build.resolve(args.path, {
          kind: args.kind,
          importer: args.importer,
          resolveDir: args.resolveDir,
          pluginName: "block-main-worker-imports",
        });
        if (result.errors.length > 0) return { errors: result.errors };
        if (!isWorkerModulePath(result.path)) return;

        return {
          errors: [
            {
              text:
                `Main bundle cannot import worker module "${result.path}". ` +
                "Keep worker code in worker.ts (or *.worker.ts) and register it via modinfo workerEntry. " +
                "Do not import worker modules from main.ts.",
            },
          ],
        };
      });
    },
  };
}
