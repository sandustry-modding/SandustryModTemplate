import { safe } from "./safe";

function interpolate(text: string, params: Record<string, string | number>): string {
  let out = text;
  for (const name of Object.keys(params)) {
    out = out.split(`{${name}}`).join(String(params[name]));
  }
  return out;
}

function goodTranslation(key: string, value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value !== key;
}

export function t(
  key: string,
  fallback?: string,
  params?: Record<string, string | number>,
): string {
  const translated = safe(() => sandkit.api.i18n.t(key, params));
  if (goodTranslation(key, translated)) {
    return translated;
  }

  const base = fallback !== undefined ? fallback : key;
  if (params) {
    return interpolate(base, params);
  }
  return base;
}
