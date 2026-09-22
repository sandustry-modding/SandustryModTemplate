import type { ModInfo } from "@sandustry-modding/types/configs";

/** Published JSON Schema URL for `modinfo.json`. */
export const MODINFO_JSON_SCHEMA = "https://sandustry-modding.github.io/schemas/modinfo.json";

/** Published JSON Schema URL for `patches.json`. */
export const PATCHES_JSON_SCHEMA = "https://sandustry-modding.github.io/schemas/patches.json";

/** Drop `$schema` before passing a JSON manifest to the game or `defineModInfo`. */
export function stripJsonSchema<T extends Record<string, unknown>>(
  value: T & { $schema?: string },
): Omit<T, "$schema"> {
  const { $schema: _schema, ...rest } = value;
  return rest;
}

/** Add `$schema` for authoring `modinfo.json` in the repo. */
export function withModinfoSchema(manifest: ModInfo): ModInfo & { $schema: string } {
  return {
    $schema: MODINFO_JSON_SCHEMA,
    ...manifest,
  };
}
