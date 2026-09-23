import { registerManagementMenuButton } from "@modkit/ui";
import tailwindCss from "@modkit/ui/tailwind.css";
import { modinfo } from "../modinfo.ts";
import { Overlay } from "./Overlay.tsx";

const api = sandkit.api;
const OVERLAY_ID = `${modinfo.id}:overlay`;

function installTailwind(): void {
  const id = `${modinfo.id}-tailwind`;
  document.getElementById(id)?.remove();
  const style = document.createElement("style");
  style.id = id;
  style.textContent = tailwindCss;
  document.head.appendChild(style);
}

export function register(): void {
  installTailwind();

  const dispose = api.ui.inject(OVERLAY_ID, Overlay);
  if (!dispose) {
    console.warn("Template overlay inject failed");
  }

  registerManagementMenuButton({
    id: `${modinfo.id}:menu`,
    icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><circle cx="12" cy="12" r="8"/></svg>`,
    label: "Template",
    hotkey: "F1",
    onClick: () => {
      api.ui.toast("Template menu row clicked", {});
    },
  });
}
