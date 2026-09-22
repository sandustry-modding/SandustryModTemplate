/** Published JSON Schema URLs for IDE validation. */
export const MODINFO_JSON_SCHEMA = "https://sandustry-modding.github.io/schemas/modinfo.json";

export const PATCHES_JSON_SCHEMA = "https://sandustry-modding.github.io/schemas/patches.json";

/**
 * Remove `$schema` before writing game-facing JSON.
 * @param {unknown} value
 */
export function stripJsonSchema(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const { $schema: _schema, ...rest } = /** @type {Record<string, unknown>} */ (value);
  return rest;
}

/**
 * @param {Record<string, unknown>} manifest
 */
export function withModinfoSchema(manifest) {
  return {
    $schema: MODINFO_JSON_SCHEMA,
    ...manifest,
  };
}
