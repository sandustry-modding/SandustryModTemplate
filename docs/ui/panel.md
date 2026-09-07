# Panel

Host widget from `sandkit.api.ui.components.Panel`.
Use this for the in-game panel chrome with an optional title.
This is not `PanelCard` or `OptionsPanel`.

There is no static canvas.
The widget only renders inside Sandustry.

## Props

| Prop        | Type            | Default | Description              |
| ----------- | --------------- | ------- | ------------------------ |
| `title`     | `LocalizedText` | —       | Optional panel title.    |
| `children`  | `ReactNode`     | —       | Panel body.              |
| `className` | `string`        | —       | Extra class names.       |
| `style`     | `CSSProperties` | —       | Inline style.            |

## Usage

```tsx
import { Button, Panel } from "@modkit/ui";

<Panel title="Options">
  <Button onClick={save}>Save</Button>
</Panel>;
```

API: [sandkit.api.ui.components.Panel](https://sandustry-modding.github.io/SandustryTypes/#/api/sandkit.api.ui.components?id=panel).
