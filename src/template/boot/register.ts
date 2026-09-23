const api = sandkit.api;

/** Runs on load while the mod is enabled. */
export function register(): void {
  api.ui.toast("Template loaded", {});
}
