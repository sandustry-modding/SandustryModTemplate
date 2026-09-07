# ActionSlot

Host widget from `sandkit.api.ui.components.ActionSlot`.
Use this for a live hotbar action cell bound to a bank source.
This is not `HotbarSlot`.

There is no static canvas.
The widget only renders inside Sandustry.

## Props

| Prop        | Type               | Default | Description                                          |
| ----------- | ------------------ | ------- | ---------------------------------------------------- |
| `source`    | `HotbarBankSource` | —       | Bank source from `api.ui.hotbar.createBankSource`.   |
| `slotIndex` | `number`           | —       | Slot index in the bank.                              |
| `action`    | `Action`           | —       | Action shown in the slot.                            |
| `keyLabel`  | `string`           | —       | Optional key label on the slot.                      |
| `active`    | `boolean`          | —       | When true, draw the slot as selected.                |
| `onSelect`  | `() => void`       | —       | Called when the player selects the slot.             |
| `onClear`   | `() => void`       | —       | Called when the player clears the slot.              |

## Usage

```tsx
import { ActionSlot } from "@modkit/ui";

const source = sandkit.api.ui.hotbar.createBankSource({
  bankOffset: 1,
  minimumBankCount: 2,
});

<ActionSlot source={source} slotIndex={0} keyLabel="1" />;
```

API: [sandkit.api.ui.components.ActionSlot](https://sandustry-modding.github.io/SandustryTypes/#/api/sandkit.api.ui.components?id=actionslot).
