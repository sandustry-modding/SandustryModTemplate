import * as esbuild from "esbuild";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { dirname, isAbsolute, join, normalize } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildPatches } from "../lib/build-patches.js";
import { kv, styleText } from "../lib/cli-style.js";
import { debugIgnoreSourceSuffixes, markDebugSourcesIgnored } from "../lib/source-map-ignore.js";
import {
  bundledContentFiles,
  compileTailwindUtilities,
  findTailwindCssEntry,
  OPTIONS_CSS_FILTER,
  MODKIT_OPTIONS_CSS,
  MODKIT_OPTIONS_CSS_ENTRY,
  readModkitOptionsCss,
} from "../lib/compile-tailwind.js";
import {
  loadMods,
  modIsolationPlugin,
  prepareModOutputs,
  publishStagingDir,
  PUBLISH_OUT_ROOT,
} from "../lib/mods.js";
import { ensureExamplesRepo } from "../lib/examples-repo.js";
import { copyWorkshopInstallFiles, removeWorkshopPublishFiles } from "../lib/workshop-files.js";
import { modkitAliasPlugin } from "../lib/modkit-alias.js";
import { stripJsonSchema } from "../lib/json-schemas.js";
import { loadModManifestExports } from "../lib/mod-manifest.js";
import { writeJsonIfChanged, writeTextIfChanged } from "../lib/write-if-changed.js";

const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const MODKIT_DIR = join(ROOT, "modkit");
const INTERNAL_ESBUILD = join(MODKIT_DIR, "internal/esbuild");
const CONSOLE_SHIM = join(INTERNAL_ESBUILD, "console.ts");
const args = process.argv.slice(2);
if (args.includes("--examples")) ensureExamplesRepo(ROOT);
const watch = args.includes("--watch");
const game = args.includes("--game");
const debugFlag = args.includes("--debug");
const noDebugFlag = args.includes("--no-debug");
const sourcemapFlag = args.includes("--sourcemap");
const noSourcemapFlag = args.includes("--no-sourcemap");

/** @returns {boolean} */
function resolveModDebug() {
  if (noDebugFlag) return false;
  if (debugFlag) return true;
  return watch || game;
}

const modDebug = resolveModDebug();
/** Release `npm run build` — write to `build/<modinfo.id>/` only; no OS mods folder or `dist/` links. */
const releaseBuild = !watch && !modDebug;

/**
 * Inline maps for `new Function` eval (external `.map` links do not resolve).
 * Debug builds emit by default; `--sourcemap` / `--no-sourcemap` override.
 * @returns {"inline" | undefined}
 */
function resolveSourcemap() {
  if (noSourcemapFlag) return undefined;
  if (sourcemapFlag || modDebug) return "inline";
  return undefined;
}

const sourcemap = resolveSourcemap();

const mods = await loadMods(args);
if (releaseBuild) {
  for (const mod of mods) {
    mod.outDir = publishStagingDir(mod.gameId);
    mkdirSync(mod.outDir, { recursive: true });
    // Drop legacy `build/<folder>/` when staging moved to `build/<modinfo.id>/`.
    if (mod.folder !== mod.gameId) {
      rmSync(join(PUBLISH_OUT_ROOT, mod.folder), {
        recursive: true,
        force: true,
      });
    }
  }
} else {
  prepareModOutputs(ROOT, mods);
}

console.log(
  kv("mods", mods.map((mod) => styleText("bold", mod.folder)).join(styleText("dim", ", "))),
);
console.log(kv("mod debug", modDebug ? styleText("green", "on") : styleText("dim", "off")));
console.log(kv("sourcemap", sourcemap ?? styleText("dim", "off")));

/**
 * Write modinfo.json from the loaded manifest.
 * @param {import("../lib/mods.js").LoadedMod} mod
 * @param {import("../lib/mods.js").LoadedMod["manifest"]} manifest
 */
function writeModinfo(mod, manifest) {
  writeJsonIfChanged(join(mod.outDir, "modinfo.json"), stripJsonSchema(structuredClone(manifest)));
}

/**
 * Copy static files and write modinfo.json + patches.json.
 * @param {import("./mods.js").LoadedMod} mod
 */
async function syncModFiles(mod) {
  mkdirSync(mod.outDir, { recursive: true });
  const loaded = await loadModManifestExports(mod.dir, `${mod.folder}-sync`, mod.manifestLabel);
  writeModinfo(mod, loaded.modinfo);
  copyWorkshopInstallFiles(mod.dir, mod.outDir);
  removeWorkshopPublishFiles(mod.outDir);
  const staticDir = join(mod.dir, "mod");
  if (existsSync(staticDir)) {
    for (const name of readdirSync(staticDir)) {
      if (name === "patches.json" || name === "modinfo.json") continue;
      if (name.endsWith(".save")) continue;
      cpSync(join(staticDir, name), join(mod.outDir, name), {
        recursive: true,
        force: true,
      });
    }
  }
  await buildPatches(mod.outDir, {
    modDebug,
    modDir: mod.dir,
    cachePrefix: mod.folder,
    label: mod.manifestLabel,
    loaded,
  });
}

function logBuildResult(mod, result) {
  if (result.errors.length > 0) return;
  console.log(
    `${styleText("green", "built")} ${styleText("bold", mod.folder)} ${styleText("dim", `to ${mod.outDir}`)}`,
  );
}

/** Resolve `@modkit/...` to `modkit/...`. */
function modkitAliasPluginForBuild() {
  return modkitAliasPlugin(MODKIT_DIR);
}

/**
 * Browser bundle must not embed patch payloads if something imports `@modkit/patches`.
 * Build-time `build-patches.js` still resolves the real module.
 */
function browserPatchesStubPlugin() {
  return {
    name: "browser-patches-stub",
    setup(build) {
      build.onResolve({ filter: /^@modkit\/patches$/ }, () => ({
        path: join(INTERNAL_ESBUILD, "patches.empty.ts"),
      }));
    },
  };
}

const MODKIT_CSS_NAMESPACE = "modkit-css";

/** Route `@modkit/ui/*.css` away from esbuild's default CSS loader (emits `main.css` / `{}`). */
function modkitCssResolvePlugin() {
  return {
    name: "modkit-css-resolve",
    setup(build) {
      build.onResolve({ filter: /^@modkit\/ui\/(?:tailwind|options)\.css$/ }, (args) => ({
        path: join(MODKIT_DIR, "ui", args.path.slice("@modkit/ui/".length)),
        namespace: MODKIT_CSS_NAMESPACE,
      }));
      build.onResolve({ filter: /[\\/]modkit[\\/]ui[\\/]options[\\/]options\.css$/ }, (args) => ({
        path: args.path,
        namespace: MODKIT_CSS_NAMESPACE,
      }));
    },
  };
}

/** Empty CSS so the first graph pass can list bundled sources without a CSS cycle. */
function stubCssPlugin() {
  return {
    name: "modkit-css-stub",
    setup(build) {
      build.onLoad({ filter: /.*/, namespace: MODKIT_CSS_NAMESPACE }, (args) => ({
        contents: "",
        loader: "text",
        watchFiles: [args.path],
      }));
    },
  };
}

/** @param {() => string} getTailwindCss */
function modkitCssTextPlugin(getTailwindCss) {
  return {
    name: "modkit-css-text",
    setup(build) {
      build.onLoad({ filter: /.*/, namespace: MODKIT_CSS_NAMESPACE }, (args) => {
        if (
          OPTIONS_CSS_FILTER.test(args.path) ||
          args.path.endsWith("options/options.css") ||
          args.path.endsWith("options\\options.css")
        ) {
          return {
            contents: readModkitOptionsCss(),
            loader: "text",
            watchFiles: [MODKIT_OPTIONS_CSS_ENTRY, MODKIT_OPTIONS_CSS],
          };
        }
        return {
          contents: getTailwindCss(),
          loader: "text",
          watchFiles: [args.path],
        };
      });
    },
  };
}

const SOURCE_MAP_DATA_MARKER = "//# sourceMappingURL=data:application/json;base64,";
const SOURCE_URL_RE = /\n\/\/# sourceURL=.*$/;

/**
 * Sandkit loads `main.js` via `new Function("__sandkit", body)` where `body` is:
 *   "use strict";\nconst sandkit = __sandkit;\nreturn (async () => {\n<source>\n})();\n
 * The Function header is two lines, then three body lines — five lines before `<source>`.
 */
const SANDKIT_LOADER_LINE_OFFSET = 5;

/**
 * Source-map `sources` must be `file://` URLs. A data: map has no file base, so
 * absolute filesystem paths do not resolve in VS Code / CDP.
 * @param {string} source
 * @param {string} outDir
 */
function toSourceMapFileUrl(source, outDir) {
  if (typeof source !== "string" || source.length === 0) return source;
  if (source.startsWith("file:")) return source;
  const abs = isAbsolute(source) ? normalize(source) : normalize(join(outDir, source));
  return pathToFileURL(abs).href;
}

/**
 * Mark the console alias shim as ignore-listed.
 * Debuggers and DevTools then skip those frames on console output.
 * @param {{ sources?: string[]; ignoreList?: number[] }} map
 */
function markConsoleInjectIgnored(map) {
  markDebugSourcesIgnored(map, debugIgnoreSourceSuffixes());
}

/**
 * Make inline maps work for VS Code / CDP on sandkit `new Function` eval:
 * - `file://` `sources` (maps resolve when the script URL is `sandkit-workshop://…`)
 * - indexed map offset matching the sandkit loader wrapper
 * - `sourceURL` matching the game (`sandkit-workshop://<modId>/main.js`)
 * @param {string} filePath
 * @param {string} modId
 */
function rewriteMainJsDebugMaps(filePath, modId) {
  let code = readFileSync(filePath, "utf8");
  code = code.replace(SOURCE_URL_RE, "");

  const sourceURL = `sandkit-workshop://${modId}/main.js`;
  const mapIdx = code.lastIndexOf(SOURCE_MAP_DATA_MARKER);
  if (mapIdx < 0) {
    console.warn(`no inline source map in ${filePath}`);
    writeTextIfChanged(filePath, `${code}\n//# sourceURL=${sourceURL}\n`);
    return;
  }

  const lineEnd = code.indexOf("\n", mapIdx);
  const mapLineEnd = lineEnd === -1 ? code.length : lineEnd;
  const b64 = code.slice(mapIdx + SOURCE_MAP_DATA_MARKER.length, mapLineEnd).trim();

  /** @type {{ version?: number; sources?: string[]; sourceRoot?: string; mappings?: string; names?: string[]; sourcesContent?: string[]; ignoreList?: number[] }} */
  let map;
  try {
    map = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  } catch {
    console.warn(`invalid inline source map in ${filePath}`);
    return;
  }

  const outDir = dirname(filePath);
  map.sources = (map.sources ?? []).map((source) => toSourceMapFileUrl(source, outDir));
  delete map.sourceRoot;
  markConsoleInjectIgnored(map);

  /** @type {{ version: number; sections: { offset: { line: number; column: number }; map: typeof map }[] }} */
  const indexed = {
    version: 3,
    sections: [{ offset: { line: SANDKIT_LOADER_LINE_OFFSET, column: 0 }, map }],
  };

  const nextB64 = Buffer.from(JSON.stringify(indexed)).toString("base64");
  writeTextIfChanged(
    filePath,
    `${code.slice(0, mapIdx)}${SOURCE_MAP_DATA_MARKER}${nextB64}\n//# sourceURL=${sourceURL}\n`,
  );
}

/**
 * @param {import("../lib/mods.js").LoadedMod} mod
 */
function maybeRewriteDebugMaps(mod) {
  const outMain = join(mod.outDir, "main.js");
  if (!sourcemap || !existsSync(outMain)) return;
  rewriteMainJsDebugMaps(outMain, manifestModId(mod));
}

/**
 * @param {import("../lib/mods.js").LoadedMod} mod
 */
function maybePatchWorkerSourceMap(mod) {
  if (!sourcemap || !mod.worker) return;
  const workerEntry =
    typeof mod.manifest.workerEntry === "string" && mod.manifest.workerEntry.length > 0
      ? mod.manifest.workerEntry
      : "worker.js";
  patchInlineSourceMap(join(mod.outDir, workerEntry));
}

/**
 * Patch a plain inline source map (worker bundles): `file://` sources and ignore-list console shim.
 * @param {string} filePath
 */
function patchInlineSourceMap(filePath) {
  if (!existsSync(filePath)) return;

  let code = readFileSync(filePath, "utf8");
  const mapIdx = code.lastIndexOf(SOURCE_MAP_DATA_MARKER);
  if (mapIdx < 0) return;

  const lineEnd = code.indexOf("\n", mapIdx);
  const mapLineEnd = lineEnd === -1 ? code.length : lineEnd;
  const b64 = code.slice(mapIdx + SOURCE_MAP_DATA_MARKER.length, mapLineEnd).trim();

  /** @type {{ version?: number; sources?: string[]; sourceRoot?: string; mappings?: string; names?: string[]; sourcesContent?: string[]; ignoreList?: number[] }} */
  let map;
  try {
    map = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  } catch {
    console.warn(`invalid inline source map in ${filePath}`);
    return;
  }

  const outDir = dirname(filePath);
  map.sources = (map.sources ?? []).map((source) => toSourceMapFileUrl(source, outDir));
  delete map.sourceRoot;
  markConsoleInjectIgnored(map);

  const nextB64 = Buffer.from(JSON.stringify(map)).toString("base64");
  writeTextIfChanged(filePath, `${code.slice(0, mapIdx)}${SOURCE_MAP_DATA_MARKER}${nextB64}\n`);
}

/**
 * @param {import("../lib/mods.js").LoadedMod} mod
 * @returns {string}
 */
function manifestModId(mod) {
  return typeof mod.manifest.id === "string" && mod.manifest.id.length > 0
    ? mod.manifest.id
    : "mod";
}

/**
 * Shared options for main and worker browser bundles.
 * @param {import("../lib/mods.js").LoadedMod} mod
 * @returns {import("esbuild").BuildOptions}
 */
function commonBundleOptions(mod) {
  return {
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2020",
    treeShaking: true,
    sourcemap,
    define: {
      __MOD_DEBUG__: modDebug ? "true" : "false",
      __MOD_ID__: JSON.stringify(manifestModId(mod)),
    },
    alias: {
      console: CONSOLE_SHIM,
    },
    inject: ["console"],
    logLevel: "info",
  };
}

/**
 * @param {import("../lib/mods.js").LoadedMod} mod
 * @returns {import("esbuild").BuildOptions}
 */
function bundleOptions(mod) {
  const common = commonBundleOptions(mod);
  return {
    ...common,
    entryPoints: [mod.main],
    outfile: join(mod.outDir, "main.js"),
    alias: {
      ...common.alias,
      react: join(INTERNAL_ESBUILD, "react.ts"),
      "react/jsx-runtime": join(INTERNAL_ESBUILD, "jsx-runtime.ts"),
      "react/jsx-dev-runtime": join(INTERNAL_ESBUILD, "jsx-dev-runtime.ts"),
    },
    jsx: "automatic",
    jsxImportSource: "react",
    banner: {
      js: [
        `// Generated — edit ${mod.repoPath}/ and run npm run dev.`,
        "// Runs as a plain script via new Function(...). No import/export.",
        "// sandkit is already in scope (loader wraps the body).",
        "const electron = globalThis.window?.electron;",
      ].join("\n"),
    },
  };
}

/**
 * Worker bundle — same esm script body + free `sandkit`, no React inject.
 * Console alias adds a `[modId]` prefix on every `console.*` line.
 * @param {import("../lib/mods.js").LoadedMod} mod
 * @returns {import("esbuild").BuildOptions}
 */
function workerBundleOptions(mod) {
  const workerEntry =
    typeof mod.manifest.workerEntry === "string" && mod.manifest.workerEntry.length > 0
      ? mod.manifest.workerEntry
      : "worker.js";
  return {
    ...commonBundleOptions(mod),
    entryPoints: [mod.worker],
    outfile: join(mod.outDir, workerEntry),
    banner: {
      js: [
        `// Generated — edit ${mod.repoPath}/worker.ts and run npm run dev.`,
        "// Worker entry via new Function(...). No import/export.",
        "// sandkit is already in scope (worker-thread api).",
        "const electron = globalThis.window?.electron;",
      ].join("\n"),
    },
  };
}

/**
 * @param {import("./mods.js").LoadedMod} mod
 */
function basePlugins(mod) {
  return [
    modIsolationPlugin(ROOT),
    browserPatchesStubPlugin(),
    modkitCssResolvePlugin(),
    modkitAliasPluginForBuild(),
    mainEntryBootstrapPlugin(mod),
    gifWorkerAsTextPlugin(),
    workerTextPlugin(),
  ];
}

/**
 * `import source from "modern-gif/worker"` must stay a string. Bundling that
 * file as JS would run `self.onmessage` on the renderer thread.
 */
function gifWorkerAsTextPlugin() {
  return {
    name: "gif-worker-as-text",
    setup(build) {
      build.onLoad({ filter: /node_modules[\\/]modern-gif[\\/]dist[\\/]worker\.js$/ }, (args) => ({
        contents: `export default ${JSON.stringify(readFileSync(args.path, "utf8"))};`,
        loader: "js",
        watchFiles: [args.path],
      }));
    },
  };
}

/**
 * `import source from "./foo.ts?worker-text"` inlines a bundled IIFE worker as a string.
 */
function workerTextPlugin() {
  return {
    name: "worker-text",
    setup(build) {
      build.onResolve({ filter: /\?worker-text$/ }, async (args) => {
        const bare = args.path.replace(/\?worker-text$/, "");
        const resolved = await build.resolve(bare, {
          kind: "import-statement",
          importer: args.importer,
          resolveDir: args.resolveDir,
        });
        if (resolved.errors.length > 0) return { errors: resolved.errors };
        return { path: resolved.path, namespace: "worker-text" };
      });
      build.onLoad({ filter: /.*/, namespace: "worker-text" }, async (args) => {
        const result = await esbuild.build({
          absWorkingDir: ROOT,
          bundle: true,
          entryPoints: [args.path],
          format: "iife",
          logLevel: "silent",
          platform: "browser",
          target: "es2020",
          write: false,
        });
        const text = result.outputFiles?.[0]?.text ?? "";
        return {
          contents: `export default ${JSON.stringify(text)};`,
          loader: "js",
          watchFiles: [args.path],
        };
      });
    },
  };
}

/**
 * esbuild `watchDirs` is not recursive. Walk a folder so nested static files
 * still trigger `syncModFiles`.
 * @param {string} root
 * @returns {string[]}
 */
function collectWatchDirs(root) {
  /** @type {string[]} */
  const dirs = [];
  const walk = (dir) => {
    dirs.push(dir);
    let names;
    try {
      names = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of names) {
      if (name === "node_modules" || name === ".git") continue;
      const next = join(dir, name);
      try {
        if (statSync(next).isDirectory()) walk(next);
      } catch {
        /* removed while walking */
      }
    }
  };
  if (existsSync(root)) walk(root);
  return dirs;
}

/**
 * Watch roots outside the module graph. Imported `modkit/` files are already
 * watched. The mod manifest path is in `watchFiles`. Static copies live under `mod/`.
 * @param {import("./mods.js").LoadedMod} mod
 * @returns {string[]}
 */
function extraWatchDirs(mod) {
  return collectWatchDirs(join(mod.dir, "mod"));
}

/**
 * Main entry only (workers skip this):
 * Wrap the entry body in try/catch so load failures log with `console.error`
 * (modId prefix via console alias). Attach watch roots for the manifest and static `mod/`.
 *
 * Uses a block wrap (not top-level `return`) because entries with `import` are
 * ESM and reject top-level return.
 * @param {import("./mods.js").LoadedMod} mod
 */
function mainEntryBootstrapPlugin(mod) {
  const mainPath = normalize(mod.main);
  return {
    name: "main-entry-bootstrap",
    setup(build) {
      build.onLoad({ filter: /\.[cm]?tsx?$/ }, (args) => {
        if (normalize(args.path) !== mainPath) return;
        const source = readFileSync(args.path, "utf8");
        const loader = args.path.endsWith(".tsx") ? "tsx" : "ts";
        const { imports, body } = splitLeadingImports(source);
        return {
          contents: [imports, `try {`, body, `} catch (error) {`, `  console.error(error);`, `}`]
            .filter((part) => part.length > 0)
            .join("\n"),
          loader,
          watchFiles: [args.path, mod.manifestPath],
          watchDirs: extraWatchDirs(mod),
        };
      });
    },
  };
}

/**
 * Pull leading `import` statements so the try/catch can wrap the rest of the
 * entry (imports must stay top-level in ESM).
 * @param {string} source
 */
function splitLeadingImports(source) {
  const match = source.match(
    /^((?:\s*import\s+(?:type\s+)?(?:[\s\S]*?from\s*)?["'][^"']+["']\s*;\s*)+)/,
  );
  if (!match) return { imports: "", body: source };
  return {
    imports: match[1].trim(),
    body: source.slice(match[1].length).trimStart(),
  };
}

/**
 * @param {import("./mods.js").LoadedMod} mod
 */
async function compileFromBundleGraph(mod) {
  const result = await esbuild.build({
    ...bundleOptions(mod),
    write: false,
    logLevel: "silent",
    metafile: true,
    plugins: [...basePlugins(mod), stubCssPlugin()],
  });
  const cssEntry = findTailwindCssEntry(result.metafile, ROOT);
  if (!cssEntry) return "";
  return compileTailwindUtilities(bundledContentFiles(result.metafile, ROOT), cssEntry);
}

function removeStrayMainCss(mod) {
  const stray = join(mod.outDir, "main.css");
  if (existsSync(stray)) rmSync(stray);
}

/**
 * @param {import("./mods.js").LoadedMod} mod
 */
async function buildOne(mod) {
  await syncModFiles(mod);
  let tailwindCss = await compileFromBundleGraph(mod);
  const result = await esbuild.build({
    ...bundleOptions(mod),
    plugins: [...basePlugins(mod), modkitCssTextPlugin(() => tailwindCss)],
  });
  removeStrayMainCss(mod);
  maybeRewriteDebugMaps(mod);
  logBuildResult(mod, result);

  if (mod.worker) {
    const workerResult = await esbuild.build({
      ...workerBundleOptions(mod),
      plugins: basePlugins(mod),
    });
    maybePatchWorkerSourceMap(mod);
    logBuildResult(mod, workerResult);
  }
}

/**
 * @param {import("./mods.js").LoadedMod} mod
 */
async function watchOne(mod) {
  await syncModFiles(mod);
  let tailwindCss = await compileFromBundleGraph(mod);
  /** @type {ReturnType<typeof setTimeout> | null} */
  let cssRebuildTimer = null;

  const mainCtx = await esbuild.context({
    ...bundleOptions(mod),
    metafile: true,
    plugins: [
      ...basePlugins(mod),
      modkitCssTextPlugin(() => tailwindCss),
      {
        name: "sync-mod",
        setup(build) {
          build.onEnd(async (result) => {
            if (result.errors.length > 0) return;

            const queueCssRebuild = () => {
              if (cssRebuildTimer != null) clearTimeout(cssRebuildTimer);
              cssRebuildTimer = setTimeout(() => {
                cssRebuildTimer = null;
                void mainCtx.rebuild();
              }, 0);
            };

            const cssEntry = findTailwindCssEntry(result.metafile, ROOT);
            if (cssEntry) {
              const next = await compileTailwindUtilities(
                bundledContentFiles(result.metafile, ROOT),
                cssEntry,
              );
              if (next !== tailwindCss) {
                tailwindCss = next;
                queueCssRebuild();
                return;
              }
            } else if (tailwindCss) {
              tailwindCss = "";
              queueCssRebuild();
              return;
            }

            maybeRewriteDebugMaps(mod);
            removeStrayMainCss(mod);
            await syncModFiles(mod);
            logBuildResult(mod, result);
          });
        },
      },
    ],
  });

  await mainCtx.watch({ delay: 10 });

  if (mod.worker) {
    const workerCtx = await esbuild.context({
      ...workerBundleOptions(mod),
      plugins: [
        ...basePlugins(mod),
        {
          name: "sync-worker",
          setup(build) {
            build.onEnd(async (result) => {
              if (result.errors.length > 0) return;
              maybePatchWorkerSourceMap(mod);
              await syncModFiles(mod);
              logBuildResult(mod, result);
            });
          },
        },
      ],
    });
    await workerCtx.watch({ delay: 10 });
  }
}

if (watch) {
  for (const mod of mods) {
    await watchOne(mod);
  }
} else {
  for (const mod of mods) {
    await buildOne(mod);
  }
}
