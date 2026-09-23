import { modinfo } from "../modinfo.ts";

const api = sandkit.api;
const BINDING_TOAST = `${modinfo.id}.toast`;

export function register(): void {
  api.input.registerBinding(BINDING_TOAST, ["KeyT"], {
    displayName: "Show toast",
    category: modinfo.name,
    handlers: {
      down: () => {
        api.ui.toast("Input binding fired", {});
      },
    },
  });
}
