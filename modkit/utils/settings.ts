import { safe } from "./safe";

export function isEnabled(): boolean {
  const value = safe(() => sandkit.api.settings.get("enabled"));
  return typeof value === "boolean" ? value : true;
}
