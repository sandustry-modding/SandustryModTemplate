import { useEffect, useState } from "react";
import {
  FixedAnchor,
  HotkeyBadge,
  Interactive,
  OverlayRoot,
  SectionHeading,
  UiBox,
} from "@modkit/ui";

const TOGGLE_CODE = "KeyE";

export function Overlay() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!event.altKey || event.code !== TOGGLE_CODE) return;
      event.preventDefault();
      event.stopPropagation();
      setOpen((value) => !value);
    }
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  if (!open) return null;

  return (
    <OverlayRoot>
      <FixedAnchor anchor="top-left">
        <Interactive>
          <UiBox className="bg-black bg-opacity-85 p-4 shadow-lg card-2 w-[28rem] text-white">
            <SectionHeading size="md">Template overlay</SectionHeading>
            <p className="text-sm opacity-80 mb-3">Replace this panel with your HUD.</p>
            <p className="text-sm flex items-center gap-1">
              Press <HotkeyBadge>Alt</HotkeyBadge>+<HotkeyBadge>E</HotkeyBadge> to close.
            </p>
          </UiBox>
        </Interactive>
      </FixedAnchor>
    </OverlayRoot>
  );
}
