# DuckGrid

A generic data grid Web Component powered by DuckDB WASM. Accepts any Parquet or CSV file — columns, filters, and search are all discovered at runtime from the actual schema.

```html
<duck-grid src="/data/sales.parquet" page-size="100"></duck-grid>
```

---

## Installation

```bash
npm install @aganitha/duck-grid @duckdb/duckdb-wasm
```

---

## Usage

### Plain HTML

No build step required — import directly from a CDN or your bundle:

```html
<script type="module">
  import '@aganitha/duck-grid';
</script>

<duck-grid src="/data/sales.csv" page-size="50" theme="dark"></duck-grid>
```

---

### React

```bash
npm install @aganitha/duck-grid @duckdb/duckdb-wasm
```

```tsx
import '@aganitha/duck-grid';

export default function DataPage() {
  return <duck-grid src="/data/sales.parquet" page-size="100" />;
}
```

<!-- For TypeScript, add type support in your `src/globals.d.ts` (or any `.d.ts` file):

```ts
/// <reference types="@aganitha/duck-grid/react" />
```

This gives you autocomplete and type checking for `<duck-grid>` in JSX. -->

---

### Next.js

DuckDB WASM requires browser APIs and cannot run server-side. You need to load the component client-side only.

```bash
npm install @aganitha/duck-grid @duckdb/duckdb-wasm
```

**Step 1** — Create a client wrapper:

```tsx
// components/DuckGridClient.tsx
'use client';

import '@aganitha/duck-grid';

export default function DuckGridClient() {
  return <duck-grid src="/data/sales.parquet" page-size="100" />; //file is in public folder here
}
```

**Step 2** — Load it dynamically with `ssr: false` in your page:

```tsx
// app/page.tsx
import dynamic from 'next/dynamic';

const DuckGridClient = dynamic(() => import('../components/DuckGridClient'), {
  ssr: false,
  loading: () => <p>Loading data grid…</p>,
});

export default function Page() {
  return <DuckGridClient />;
}
```

> **Why two files?** `dynamic` with `ssr: false` only skips SSR for the dynamically imported module. If the import is in the same file as the page, Next.js still evaluates it on the server. Splitting into two files ensures `@aganitha/duck-grid` never runs in Node.js.

<!-- For TypeScript, add type support in your `types/globals.d.ts`:

```ts
/// <reference types="@aganitha/duck-grid/react" />
``` -->

**File serving** — place your data files in the `public/` folder so Next.js serves them:

```
my-app/
  public/
    data/
      sales.parquet   ← accessible at /data/sales.parquet
```

---

<!-- ### Vue

```bash
npm install @aganitha/duck-grid @duckdb/duckdb-wasm
```

```vue
<script setup>
import '@aganitha/duck-grid';
</script>

<template>
  <duck-grid src="/data/sales.csv" page-size="100" />
</template>
```

Tell the Vue compiler not to treat `duck-grid` as a missing component:

```ts
// vite.config.ts
export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag) => tag === 'duck-grid',
        },
      },
    }),
  ],
});
```

For TypeScript type support, add to your `src/env.d.ts`:

```ts
/// <reference types="@aganitha/duck-grid/vue" />
```

--- -->

### Astro

```astro
<script>
  import '@aganitha/duck-grid';
</script>

<duck-grid src="/data/sales.parquet" />
```

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
import { applyTheme, DARK_THEME } from '@aganitha/duck-grid';
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