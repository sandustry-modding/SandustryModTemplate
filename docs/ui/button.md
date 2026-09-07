# Button

Host widget from `sandkit.api.ui.components.Button`.
Use this for the in-game button chrome.
This is not `OptionsButton` or `MenuButton`.

There is no static canvas.
The widget only renders inside Sandustry.

## Props

| Prop        | Type                          | Default | Description                          |
| ----------- | ----------------------------- | ------- | ------------------------------------ |
| `children`  | `ReactNode`                   | —       | Button label or content.             |
| `active`    | `boolean`                     | —       | When true, draw as selected.         |
| `border`    | `boolean`                     | —       | When false, hide the border.         |
| `disabled`  | `boolean`                     | —       | When true, ignore clicks.            |
| `small`     | `boolean`                     | —       | When true, use the small size.       |
| `variant`   | `"primary" \| "danger"`       | —       | Visual style.                        |
| `className` | `string`                      | —       | Extra class names.                   |
| `style`     | `CSSProperties`               | —       | Inline style.                        |
| `onClick`   | `() => void`                  | —       | Click handler.                       |

## Usage

```tsx
import { Button } from "@modkit/ui";

<Button onClick={openPanel}>Open</Button>;
```

API: [sandkit.api.ui.components.Button](https://sandustry-modding.github.io/SandustryTypes/#/api/sandkit.api.ui.components?id=button).
