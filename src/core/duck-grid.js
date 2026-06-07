import { injectStyles, applyTheme, DARK_THEME } from "../styles/index.js";
import { getDuckDB } from "./db.js";
import { detectSchema } from "../query/schema.js";
import { buildWhere, buildOrderBy } from "../query/where.js";
import { renderToolbar, renderPerfBar, renderFooter } from "../ui/toolbar.js";
import { renderTableHeader, renderTableBody } from "../ui/table.js";
import { exportCSV } from "../utils/export.js";
import { FilterDialog } from "../filter-dialog.js";

let instanceCounter = 0;

class DuckGrid extends HTMLElement {
  #id = ++instanceCounter;
  #conn = null;
  #viewName = "";
  #schema = [];
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
  #filterDialog = new FilterDialog();

  #q = (sel) => this.querySelector(sel);
  #id_el = (suf) => this.querySelector(`[data-dg="${this.#id}-${suf}"]`);

  connectedCallback() {
    injectStyles();
    this.#pageSize = Number(this.getAttribute("page-size") || 100);
    this.#viewName = `dg_view_${this.#id}`;
    if (this.getAttribute("theme") === "dark") applyTheme(DARK_THEME);
    if (this.getAttribute("height")) {
      this.style.height = this.getAttribute("height");
      this.classList.add("dg-fixed-height");
    }

    this.#renderShell();
    this.#boot();
  }

  disconnectedCallback() {
    if (this.#conn) {
      this.#conn
        .query(`DROP VIEW IF EXISTS "${this.#viewName}"`)
        .catch(() => {});
      this.#conn.close().catch(() => {});
      this.#conn = null;
    }
  }

  #renderShell() {
    const id = this.#id;
    this.innerHTML = `
      <div class="dg-shell">
        ${renderToolbar(id)}
        ${renderPerfBar(id, this.#t)}
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
        ${renderFooter(id, this.#page, this.#totalRows, this.#pageSize)}
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
      this.#t.init = Math.round(performance.now() - t0_init);

      this.#setMsg("loading file…");
      const t0_file = performance.now();
      this.#conn = await db.connect();

      const fileKey = `dg_file_${this.#id}`;
      const absUrl = new URL(src, location.href).href;
      const isCSV = src.toLowerCase().endsWith(".csv");

      await db.registerFileURL(fileKey, absUrl, 4, false);

      const scanFn = isCSV ? `read_csv_auto` : `parquet_scan`;
      await this.#conn.query(
        `CREATE VIEW "${this.#viewName}" AS SELECT * FROM ${scanFn}('${fileKey}')`,
      );
      this.#t.file = Math.round(performance.now() - t0_file);

      this.#setMsg("detecting schema…");
      const result = await detectSchema(this.#conn, this.#viewName);
      this.#schema = result.schema;
      this.#searchCols = result.searchCols;

      this.#setMsg("running query…");
      await this.#runQuery();
    } catch (err) {
      console.error("[DuckGrid]", err);
      this.#showError(err.message);
    }
  }

  async #runQuery() {
    const where = buildWhere(this.#schema, this.#filters, this.#search, this.#searchCols);
    const orderBy = buildOrderBy(this.#sortCol, this.#sortDir);
    const offset = this.#page * this.#pageSize;

    this.#showLoading(true);
    const t0 = performance.now();

    const countRes = await this.#conn.query(
      `SELECT COUNT(*) AS n FROM "${this.#viewName}" ${where}`,
    );
    this.#totalRows = Number(countRes.toArray()[0].n);

    const rows = await this.#conn.query(`
      SELECT * FROM "${this.#viewName}"
      ${where}
      ${orderBy}
      LIMIT ${this.#pageSize} OFFSET ${offset}
    `);
    this.#t.query = Math.round(performance.now() - t0);

    const t0r = performance.now();
    this.#renderTable(
      rows.toArray(),
      rows.schema.fields.map((f) => f.name),
    );
    this.#t.render = Math.round(performance.now() - t0r);

    this.#updateFooter();
    this.#updatePerfBar();
    this.#showLoading(false);
  }

  #renderTable(rows, cols) {
    const thead = this.#id_el("thead");
    const tbody = this.#id_el("tbody");
    const table = this.#id_el("table");

    thead.innerHTML = renderTableHeader(cols, this.#sortCol, this.#sortDir, this.#filters);

    thead.querySelectorAll("th").forEach((th) => {
      th.addEventListener("click", () => {
        const col = th.dataset.col;
        if (this.#sortCol === col) {
          this.#sortDir = this.#sortDir === "ASC" ? "DESC" : "ASC";
        } else {
          this.#sortCol = col;
          this.#sortDir = "ASC";
        }
        this.#page = 0;
        this.#runQuery();
      });
    });

    thead.querySelectorAll(".dg-filter-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const col = btn.dataset.filterCol;
        this.#openFilterDialog(col, btn);
      });
    });

    tbody.innerHTML = renderTableBody(rows, cols);

    table.style.display = "";
    const countEl = this.#id_el("count");
    if (countEl) countEl.textContent = `${this.#totalRows.toLocaleString()} rows`;
    const exportBtn = this.#id_el("export");
    if (exportBtn) exportBtn.disabled = false;
  }

  async #openFilterDialog(columnName, anchor) {
    const column = this.#schema.find((c) => c.name === columnName);
    if (!column) return;

    const result = await this.#filterDialog.open({
      column: column.name,
      kind: column.kind,
      operators: column.operators,
      filters: this.#filters[column.name] || [],
      anchor,
      host: this,
    });

    if (result === null) return;

    if (!result.length) {
      delete this.#filters[column.name];
    } else {
      this.#filters[column.name] = result;
    }

    this.#page = 0;
    await this.#runQuery();
  }

  #updateFooter() {
    const footerEl = this.#id_el("footer");
    if (footerEl) footerEl.style.display = "";
    const totalPages = Math.max(1, Math.ceil(this.#totalRows / this.#pageSize));
    const pageInfo = this.#id_el("page-info");
    if (pageInfo) pageInfo.textContent = `${this.#page + 1} / ${totalPages}`;
    const prevBtn = this.#id_el("prev");
    if (prevBtn) prevBtn.disabled = this.#page === 0;
    const nextBtn = this.#id_el("next");
    if (nextBtn) nextBtn.disabled = this.#page >= totalPages - 1;
  }

  #updatePerfBar() {
    const fmt = (ms) => {
      const cls = ms < 100 ? "fast" : ms < 500 ? "med" : "slow";
      return { text: ms + "ms", cls };
    };
    const set = (suf, ms) => {
      const el = this.#id_el(`t-${suf}`);
      if (!el) return;
      const { text, cls } = fmt(ms);
      el.textContent = text;
      el.className = `dg-perf-value ${cls}`;
    };
    set("init", this.#t.init);
    set("file", this.#t.file);
    set("query", this.#t.query);
    set("render", this.#t.render);
    const total = Object.values(this.#t).reduce((a, b) => a + b, 0);
    const el = this.#id_el("t-total");
    if (el) {
      const { text, cls } = fmt(total);
      el.textContent = text;
      el.className = `dg-perf-value ${cls}`;
    }
    const perfbar = this.#id_el("perfbar");
    if (perfbar) perfbar.classList.add("visible");
  }

  #setupListeners() {
    this.#q(".dg-search")?.addEventListener("input", (e) => {
      clearTimeout(this.#searchTimer);
      this.#searchTimer = setTimeout(() => {
        this.#search = e.target.value.trim();
        this.#page = 0;
        if (this.#conn) this.#runQuery();
      }, 300);
    });

    this.#id_el("prev")?.addEventListener("click", () => {
      if (this.#page > 0) {
        this.#page--;
        this.#runQuery();
      }
    });
    this.#id_el("next")?.addEventListener("click", () => {
      if (this.#page < Math.ceil(this.#totalRows / this.#pageSize) - 1) {
        this.#page++;
        this.#runQuery();
      }
    });
    this.#id_el("page-size")?.addEventListener("change", (e) => {
      this.#pageSize = Number(e.target.value);
      this.#page = 0;
      if (this.#conn) this.#runQuery();
    });
    this.#id_el("export")?.addEventListener("click", () => this.#exportCSV());
  }

  async #exportCSV() {
    const where = buildWhere(this.#schema, this.#filters, this.#search, this.#searchCols);
    const orderBy = buildOrderBy(this.#sortCol, this.#sortDir);

    const csv = await exportCSV(this.#conn, this.#viewName, where, orderBy);
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    const filename =
      this.getAttribute("src")
        ?.split("/")
        .pop()
        ?.replace(/\.\w+$/, "") || "export";
    a.download = `${filename}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  }

  #setMsg(msg) {
    const el = this.#id_el("loading-msg");
    if (el) el.textContent = msg;
    this.#showLoading(true);
  }

  #showLoading(on) {
    const el = this.#id_el("loading");
    if (el) el.style.display = on ? "" : "none";
  }

  #showError(msg) {
    const el = this.#id_el("loading");
    if (el) el.innerHTML = `<span class="dg-loading-error">⚠ ${msg}</span>`;
  }
}

customElements.define("duck-grid", DuckGrid);
