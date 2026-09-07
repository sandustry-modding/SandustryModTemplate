# UI kit

Shared React components under `modkit/ui/`.
Import from `@modkit/ui`.

```ts
import { OverlayRoot, FixedAnchor, Interactive, Panel, Button } from "@modkit/ui";
```

Each page has a live preview (Storybook-style iframe) plus props and a usage snippet.
Browse all previews on the [gallery](README.md).

## Components

Host widgets wrap `sandkit.api.ui.components`.
They only render inside Sandustry.

| Component                      | Page                                                     |
| ------------------------------ | -------------------------------------------------------- |
| `Button`                       | [button.md](button.md)                                   |
| `Panel`                        | [panel.md](panel.md)                                     |
| `ActionSlot`                   | [action-slot.md](action-slot.md)                         |
| `HotkeyBadge`                  | [hotkey-badge.md](hotkey-badge.md)                       |
| `UiBox`                        | [ui-box.md](ui-box.md)                                   |
| `InfoBanner`                   | [info-banner.md](info-banner.md)                         |
| `PanelCard`                    | [panel-card.md](panel-card.md)                           |
| `MenuButton`                   | [menu-button.md](menu-button.md)                         |
| `registerManagementMenuButton` | [management-menu-button.md](management-menu-button.md)   |
| `ManagementMenuButton`         | [management-menu-button.md](management-menu-button.md)   |
| `ResourceRow`                  | [resource-row.md](resource-row.md)                       |
| `SectionHeading`               | [section-heading.md](section-heading.md)                 |
| `ObjectiveCard`                | [objective-card.md](objective-card.md)                   |
| `SecondaryObjectiveRow`        | [secondary-objective-row.md](secondary-objective-row.md) |
| `ObjectiveHighlight`           | [objective-highlight.md](objective-highlight.md)         |
| `ShortcutChip`                 | [shortcut-chip.md](shortcut-chip.md)                     |
| `ShortcutBar`                  | [shortcut-bar.md](shortcut-bar.md)                       |
| `ShortcutBarItem`              | [shortcut-bar-item.md](shortcut-bar-item.md)             |
| `ShortcutBarDivider`           | [shortcut-bar-divider.md](shortcut-bar-divider.md)       |
| `CompoundHotkeys`              | [compound-hotkeys.md](compound-hotkeys.md)               |
| `HotbarSlot`                   | [hotbar-slot.md](hotbar-slot.md)                         |
| `HotbarIcon`                   | [hotbar-icon.md](hotbar-icon.md)                         |
| `OverlayRoot`                  | [overlay-root.md](overlay-root.md)                       |
| `FixedAnchor`                  | [fixed-anchor.md](fixed-anchor.md)                       |
| `Interactive`                  | [interactive.md](interactive.md)                         |
| `OptionsPanel`                 | [options-panel.md](options-panel.md)                     |
| `OptionsSection`               | [options-section.md](options-section.md)                 |
| `OptionsRow`                   | [options-row.md](options-row.md)                         |
| `OptionsSelect`                | [options-select.md](options-select.md)                   |
| `OptionsSlider`                | [options-slider.md](options-slider.md)                   |
| `OptionsSliderRow`             | [options-slider-row.md](options-slider-row.md)           |
| `OptionsSwitch`                | [options-switch.md](options-switch.md)                   |
| `OptionsNumberInput`           | [options-number-input.md](options-number-input.md)       |
| `OptionsButton`                | [options-button.md](options-button.md)                   |

## Shared styles

`@modkit/ui` re-exports `modkit/ui/shared/styles.ts`:

| Export                 | Role                                   |
| ---------------------- | -------------------------------------- |
| `ACCENT`               | Sandustry yellow `rgb(255, 231, 0)`    |
| `hotkeyBadgeStyle`     | HUD badge background, border, and glow |
| `objectiveTextShadow`  | Text shadow on objective rows          |
| `sectionGradientLeft`  | Left fade for section headings         |
| `sectionGradientRight` | Right fade for section headings        |
| `hotbarSlotBackground` | Radial fill for hotbar slots           |
| `menuButtonShineStyle` | Shine sweep size for menu buttons      |

```ts
import { ACCENT, hotkeyBadgeStyle } from "@modkit/ui";
```

## Tailwind in overlays

The game Tailwind stylesheet is purged.
Classes the HUD does not use (for example `w-[28rem]`, `underline`) do nothing until this mod inserts utilities.

Import `@modkit/ui/tailwind.css` and insert the string into a `<style>` tag.
The build compiles only class names from files esbuild packed into `main.js`.
See [overlay-hotkey/main.ts](https://github.com/sandustry-modding/SandustryExamples/blob/main/ui/overlay-hotkey/main.ts).

Options rows, switches, fields, and buttons use the same Tailwind classes as the in-game Options dialog.
Import the components from `@modkit/ui` (not `@modkit/ui/options` — that path is `options.css`).
Import `@modkit/ui/options.css` only for `OptionsSlider` / `OptionsSliderRow` (thumb and track).
Insert that string into a `<style>` tag the same way.

Live canvases live under [docs/ui/canvas](canvas/).
Preview utilities are in [canvas/_preview/utilities.css](canvas/_preview/utilities.css).
Slider chrome lives in [modkit/ui/options/options.css](../../modkit/ui/options/options.css) (imported into preview [chrome.css](canvas/_preview/chrome.css)).
HUD classes (`ui-box`, `hotkey-badge`, `card-2`) stay in chrome.css.
See [builds.md](../builds.md).
