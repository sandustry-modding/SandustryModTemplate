/** esbuild console alias shim (`inject: ["console"]`). */
export const CONSOLE_INJECT_SOURCE_SUFFIX = "modkit/internal/esbuild/console.ts";

function posixPath(source) {
  return source.replace(/\\/g, "/");
}

function matchesSuffix(source, suffix) {
  const path = posixPath(source);
  return path === suffix || path.endsWith(`/${suffix}`);
}

/**
 * Mark known shim sources as ignore-listed.
 * @param {{ sources?: string[]; ignoreList?: number[] }} map
 * @param {string[]} suffixes
 */
export function markDebugSourcesIgnored(map, suffixes) {
  const sources = map.sources ?? [];
  if (sources.length === 0) return;

  const ignored = new Set(map.ignoreList ?? []);
  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];
    if (typeof source !== "string") continue;
    if (suffixes.some((suffix) => matchesSuffix(source, suffix))) {
      ignored.add(i);
    }
  }
  if (ignored.size > 0) {
    map.ignoreList = [...ignored].sort((a, b) => a - b);
  }
}

export function debugIgnoreSourceSuffixes() {
  return [CONSOLE_INJECT_SOURCE_SUFFIX];
}
