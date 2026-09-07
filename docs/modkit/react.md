# React runtime

Sandustry exposes React on `sandkit.react`.
The template does not bundle a separate React copy.
TypeScript and esbuild resolve `react` imports to thin shims in `modkit/internal/esbuild/`.

## Runtime source

`modkit/internal/esbuild/react.ts` reads the live runtime:

```ts
const runtime = sandkit.react;

export default runtime;
export const { createElement, useState, useEffect, useCallback, useMemo, useRef, Fragment } =
  runtime;
```

In mod code, write normal React imports:

```tsx
import { useState, useEffect } from "react";
import type { ReactNode } from "react";
```

At build time, esbuild maps `react` → `modkit/internal/esbuild/react.ts`.

## JSX

TypeScript (`tsconfig.json`):

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "react"
  }
}
```

esbuild (`scripts/build/esbuild.config.mjs`):

```js
alias: {
  react: join(ROOT, "modkit/internal/esbuild/react.ts"),
  "react/jsx-runtime": join(ROOT, "modkit/internal/esbuild/jsx-runtime.ts"),
  "react/jsx-dev-runtime": join(ROOT, "modkit/internal/esbuild/jsx-dev-runtime.ts"),
},
jsx: "automatic",
jsxImportSource: "react",
```

### `modkit/internal/esbuild/jsx-runtime.ts`

Automatic JSX runtime backed by `sandkit.react`.
Exports `Fragment`, `jsx`, and `jsxs`.

When `runtime.jsx` / `runtime.jsxs` exist on `sandkit.react`, those are used.
Otherwise the shim falls back to `createElement`.

### `modkit/internal/esbuild/jsx-dev-runtime.ts`

Dev runtime exports `jsxDEV`.
When `sandkit.react.jsxDEV` is missing, it falls back to production `jsx` from `jsx-runtime.ts`.

## Bundle format

The game loads `main.js` as a plain script body:

```js
new Function("sandkit", source);
```

esbuild settings:

| Option     | Value       | Why                             |
| ---------- | ----------- | ------------------------------- |
| `format`   | `"esm"`     | Bare script body (loader wraps) |
| `platform` | `"browser"` | Renderer context                |
| `bundle`   | `true`      | One `main.js` output            |

The build banner states:

- Generated output — edit `src/` and rebuild
- No `import` / `export` in the output
- `sandkit` is already in scope

Do not rely on ES modules at runtime.
All dependencies must be bundled into `main.js`.

## `@modkit/*` alias

esbuild resolves `@modkit/...` to files under `modkit/` (same as TypeScript `paths`).
Example:

```ts
import { safe } from "@modkit/utils";
```

## UI overlays

Put mod UI under `src/<name>/ui/`.
Import components from `@modkit/ui` or local files.
Register overlays with `api.ui.inject` from `src/<name>/main.ts`.

Host widgets (`Button`, `Panel`, `ActionSlot`) wrap `api.ui.components` so you can write JSX instead of `sandkit.react.createElement`.

```tsx
import { Button, Panel } from "@modkit/ui";

<Panel title="Options">
  <Button onClick={openPanel}>Open</Button>
</Panel>;
```

See [../ui/README.md](../ui/README.md) for shared UI components.
