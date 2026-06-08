# DuckGrid

A generic data grid Web Component powered by DuckDB WASM. Accepts any Parquet or CSV file — columns, filters, and search are all discovered at runtime from the actual schema.

```html
<duck-grid src="/data/sales.parquet" page-size="100"></duck-grid>
```

---

## Usage

### Plain HTML

```html
<script type="module">
  import 'duck-grid';
</script>

<duck-grid src="/data/sales.csv" page-size="50" theme="dark"></duck-grid>
```

### React / Next.js

```tsx
'use client';
import 'duck-grid';

export default function DataPage() {
  return <duck-grid src="/data/sales.parquet" page-size="100" />;
}
```

For Next.js, wrap in `dynamic(() => import('duck-grid'), { ssr: false })` because DuckDB WASM can't run server-side.

For JSX type support:

```ts
// src/env.d.ts
/// <reference types="duck-grid/react" />
```

### Vue

```vue
<script setup>
import 'duck-grid';
</script>

<template>
  <duck-grid src="/data/sales.csv" page-size="100" />
</template>
```

For Vue type support:

```ts
// src/env.d.ts
/// <reference types="duck-grid/vue" />
```

If using Vite, add to `vite.config.ts`:

```ts
compilerOptions: {
  isCustomElement: tag => tag === 'duck-grid'
}
```

### Astro

```astro
<script>
  import 'duck-grid';
</script>

<duck-grid src="/data/sales.parquet" />
```

### Svelte

Works natively — Svelte passes unknown elements to the browser as-is.

---

## Attributes

| Attribute   | Required | Default | Description |
|-------------|----------|---------|-------------|
| `src`       | yes      | —       | Path or URL to a `.parquet` or `.csv` file |
| `page-size` | no       | `100`   | Rows per page |
| `theme`     | no       | `light` | `"light"` or `"dark"` |
| `height`    | no       | auto    | Fixed height e.g. `"600px"`. Enables vertical scrolling. |

---

## Theming

Override any CSS custom property on the element:

```css
duck-grid {
  --dg-accent: #e11d48;
  --dg-font-mono: 'JetBrains Mono', monospace;
}
```

Or apply the built-in dark theme programmatically:

```js
import { applyTheme, DARK_THEME } from 'duck-grid';
applyTheme(DARK_THEME);
```

---

## API

The module exports several utilities for advanced use:

| Export | Description |
|--------|-------------|
| `applyTheme(css)` | Inject a CSS theme string into the page |
| `DARK_THEME` | Dark theme CSS string |
| `getDuckDB()` | Shared DuckDB WASM singleton |
| `detectSchema(conn, viewName)` | Detect columns, types, and operators |
| `buildWhere(schema, filters, search, searchCols)` | Build WHERE clause from filter state |
| `buildOrderBy(sortCol, sortDir)` | Build ORDER BY clause |
| `conditionToSql(column, kind, condition)` | Convert a single filter condition to SQL |
| `exportCSV(conn, viewName, where, orderBy)` | Chunked CSV export |
| `renderCell(v)` | Type-aware cell renderer |
| `escSql(s)` | Escape a string for SQL |
| `FilterDialog` | Reusable column filter dialog |
| `FilterPopover` | Reusable column filter popover |

---

## Build from source

```bash
npm install
npm run build       # builds dist/
npm run typecheck   # runs tsc --noEmit
```

Output lands in `dist/` (ESM + CJS + sourcemaps).

---

## Publishing

```bash
npm version patch   # bump version
npm publish         # runs prepublishOnly → build automatically
```

Only `dist/` and `types/` are included in the published package.
