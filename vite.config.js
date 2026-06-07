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
      external: [],
    },
    sourcemap: true,
  },
});
