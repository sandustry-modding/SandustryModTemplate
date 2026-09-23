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
}
