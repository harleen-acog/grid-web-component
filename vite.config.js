import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "src/core/index.js",
      name: "DuckGrid",
      formats: ["es", "cjs"],
      fileName: (format) =>
        `duck-grid.${format === "es" ? "esm" : "cjs"}.js`,
    },
    rollupOptions: {
      external: ["@duckdb/duckdb-wasm"],
      output: {
        // tells bundlers the global name when used via <script> tag (UMD/IIFE)
        globals: {
          "@duckdb/duckdb-wasm": "DuckDB",
        },
      },
    },
    sourcemap: true,
  },
});