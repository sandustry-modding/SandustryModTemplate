import { modinfo } from "../modinfo.ts";

const api = sandkit.api;
const BINDING = `${modinfo.id}.action`;

export function register(): void {
  api.input.registerBinding(BINDING, ["KeyT"], {
    displayName: "Template action",
    category: modinfo.name,
    handlers: {
      down: () => {
        /* Handle KeyT. */
      },
    },
  });
}
