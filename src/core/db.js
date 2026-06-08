// let duckPromise = null;

// export async function getDuckDB() {
//   if (duckPromise) return duckPromise;
//   duckPromise = (async () => {
//     const duck =
//       await import("https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.29.0/+esm");
//     const BUNDLES = {
//       mvp: {
//         mainModule:
//           "https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.29.0/dist/duckdb-mvp.wasm",
//         mainWorker:
//           "https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.29.0/dist/duckdb-browser-mvp.worker.js",
//       },
//       eh: {
//         mainModule:
//           "https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.29.0/dist/duckdb-eh.wasm",
//         mainWorker:
//           "https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.29.0/dist/duckdb-browser-eh.worker.js",
//       },
//     };
//     const bundle = await duck.selectBundle(BUNDLES);
//     const workerUrl = URL.createObjectURL(
//       new Blob([`importScripts("${bundle.mainWorker}");`], {
//         type: "text/javascript",
//       }),
//     );
//     const worker = new Worker(workerUrl);
//     const db = new duck.AsyncDuckDB(new duck.ConsoleLogger(), worker);
//     await db.instantiate(bundle.mainModule);
//     URL.revokeObjectURL(workerUrl);
//     return db;
//   })();
//   return duckPromise;
// }

let duckPromise = null;

export async function getDuckDB() {
  if (duckPromise) return duckPromise;
  duckPromise = (async () => {

    // npm import instead of CDN — works in all bundlers
    const duck = await import("@duckdb/duckdb-wasm");

    // Runtime URL strings (not static imports) — bundlers won't try to resolve these
    // Uses jsdelivr at runtime in the browser, but webpack/turbopack never sees them as imports
    const BUNDLES = {
      mvp: {
        mainModule:
          "https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.29.0/dist/duckdb-mvp.wasm",
        mainWorker:
          "https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.29.0/dist/duckdb-browser-mvp.worker.js",
      },
      eh: {
        mainModule:
          "https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.29.0/dist/duckdb-eh.wasm",
        mainWorker:
          "https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.29.0/dist/duckdb-browser-eh.worker.js",
      },
    };

    const bundle = await duck.selectBundle(BUNDLES);
    const workerUrl = URL.createObjectURL(
      new Blob([`importScripts("${bundle.mainWorker}");`], {
        type: "text/javascript",
      }),
    );
    const worker = new Worker(workerUrl);
    const db = new duck.AsyncDuckDB(new duck.ConsoleLogger(), worker);
    await db.instantiate(bundle.mainModule);
    URL.revokeObjectURL(workerUrl);
    return db;
  })();
  return duckPromise;
}