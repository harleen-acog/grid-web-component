import { applyTheme } from "./duck-grid";
import { BASE_STYLES, DARK_THEME } from "./styles";

let stylesInjected = false;
let instanceCounter = 0;
let duckPromise = null;

function injectStyles() {
  if (stylesInjected) return;
  const el = document.createElement("style");
  el.setAttribute("data-duck-grid", "");
  el.textContent = BASE_STYLES;
  //adding the style tag to the head section
  document.head.appendChild(el);
  stylesInjected = true;
}

export function applyTheme(css) {
  const el = document.createElement("style");
  el.setAttribute("data-duck-grod-theme", "");
  //remove previous theme
  document.head
    .querySelectorAll("[data-duck-grid-theme]")
    .forEach((n) => n.remove());
  el.textContent = css;
  document.head.appendChild(el);
}

async function getDuckDB() {
  if (duckPromise) return duckPromise
  duckPromise = (async () => {
    const duck = await import('https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.29.0/+esm')
    const BUNDLES = {
      mvp: {
        mainModule:  'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.29.0/dist/duckdb-mvp.wasm',
        mainWorker:  'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.29.0/dist/duckdb-browser-mvp.worker.js',
      },
      eh: {
        mainModule:  'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.29.0/dist/duckdb-eh.wasm',
        mainWorker:  'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.29.0/dist/duckdb-browser-eh.worker.js',
      },
    }
    const bundle    = await duck.selectBundle(BUNDLES)
    const workerUrl = URL.createObjectURL(
      new Blob([`importScripts("${bundle.mainWorker}");`], { type: 'text/javascript' })
    )
    const worker = new Worker(workerUrl)
    const db     = new duck.AsyncDuckDB(new duck.ConsoleLogger(), worker)
    await db.instantiate(bundle.mainModule)
    URL.revokeObjectURL(workerUrl)
    return db
  })()
  return duckPromise
}


class DuckGrid extends HTMLElement {
  #id = ++instanceCounter;
  #conn = null;
  #viewName = "";
  #schema = [];
  #filterCols = [];
  #searchCols = [];
  #filters = {};
  #search = "";
  #page = 0;
  #pageSize = 100;
  #totalRows = 0;
  #sortCol = null;
  #sortDir = "ASC";
  #t = { init: 0, file: 0, query: 0, render: 0 };
  #searchTimer = null;

  #q = (sel) => this.querySelector(sel);
  #id_el = (suf) => this.querySelector(`[data-dg="${this.#id}-${suf}"]`);

  connectedCallback() {
    //load the styling for the grid
    injectStyles();
    this.#pageSize = Number(this.getAttribute("page-size") || 100);
    this.#viewName = `dg_view_${this.#id}`;

    if (this.getAttribute("theme") === "dark") applyTheme(DARK_THEME);

    this.#render();
    this.#boot();
  }

  disconnectedCallback() {
    //clean the duckdb connection and the drop view
    if (this.#conn) {
      this.#conn
        .query(`DROP VIEW IF EXISTS "${this.#viewName}"`)
        .catch(() => {});
      this.#conn.close().catch(() => {});
      this.#conn = null;
    }
  }

  #render() {
    const id = this.#id;
    this.innerHTML = `
      <div class="dg-shell">

        <div class="dg-toolbar">
          <div class="dg-toolbar-left">
            <div class="dg-search-wrap">
              <svg class="dg-search-icon" width="13" height="13" viewBox="0 0 24 24"
                   fill="none" stroke="currentColor" stroke-width="2.5">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input data-dg="${id}-search" class="dg-search" type="text"
                     placeholder="search..." autocomplete="off" />
            </div>
            <div data-dg="${id}-filters" class="dg-filters"></div>
          </div>
          <div class="dg-toolbar-right">
            <span data-dg="${id}-count" class="dg-count"></span>
            <button data-dg="${id}-export" class="dg-btn" disabled>↓ CSV</button>
          </div>
        </div>

        <div data-dg="${id}-perfbar" class="dg-perfbar">
          ${["init", "file", "query", "render"]
            .map(
              (k) => `
            <div class="dg-perf-chip">
              <span class="dg-perf-label">${k}</span>
              <span data-dg="${id}-t-${k}" class="dg-perf-value">—</span>
            </div>`,
            )
            .join("")}
          <div class="dg-perf-chip dg-perf-total">
            <span class="dg-perf-label">Total</span>
            <span data-dg="${id}-t-total" class="dg-perf-value">—</span>
          </div>
          <div class="dg-perf-engine">DuckDB WASM</div>
        </div>

        <div class="dg-table-wrap">
          <div data-dg="${id}-loading" class="dg-loading">
            <span class="dg-spinner"></span>
            <span data-dg="${id}-loading-msg">initialising duckdb…</span>
          </div>
          <table data-dg="${id}-table" class="dg-table" style="display:none">
            <thead data-dg="${id}-thead"></thead>
            <tbody data-dg="${id}-tbody"></tbody>
          </table>
        </div>

        <div data-dg="${id}-footer" class="dg-footer" style="display:none">
          <button data-dg="${id}-prev" class="dg-btn">← prev</button>
          <span  data-dg="${id}-page-info" class="dg-page-info"></span>
          <button data-dg="${id}-next" class="dg-btn">next →</button>
          <span class="dg-sep"></span>
          <label class="dg-page-size-label">
            rows
            <select data-dg="${id}-page-size" class="dg-select">
              ${[25, 50, 100, 250, 500]
                .map(
                  (n) =>
                    `<option value="${n}"${n === this.#pageSize ? " selected" : ""}>${n}</option>`,
                )
                .join("")}
            </select>
          </label>
        </div>

      </div>`;

    this.#setupListeners();
  }

  async #boot() {
    const src = this.getAttribute("src");
    if (!src) return this.#showError("src attribute is required");

    try {
      this.#setMsg("initialising duckdb…");
      const t0_init = performance.now();
      const db = await getDuckDB();
      //recording the inital load time
      this.#t.init = Math.round(performance.now() - t0_init);
    } catch (err) {
      console.error("[DuckGrid]", err);
      this.#showError(err.message);
    }
  }
}

export { DARK_THEME };
