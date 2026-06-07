/**
 * duck-grid.js
 * A generic, schema-driven data grid Web Component powered by DuckDB WASM.
 * Accepts any Parquet or CSV file — columns, filters, and search are all
 * discovered at runtime from the actual schema.
 *
 * USAGE
 * ─────
 * import 'duck-grid'                            // registers <duck-grid>
 *
 * <duck-grid src="/data/sales.parquet"></duck-grid>
 * <duck-grid src="/data/users.csv" page-size="50" theme="dark"></duck-grid>
 *
 * ATTRIBUTES
 * ──────────
 * src          required  Path or URL to a .parquet or .csv file
 * page-size    optional  Rows per page (default: 100)
 * theme        optional  "light" (default) | "dark" | omit for custom-only
 * height       optional  Fixed height e.g. "600px". Omit to size to content.
 *
 * THEMING
 * ───────
 * Override any CSS custom property on the element:
 *   duck-grid { --dg-accent: #e11d48; --dg-font-mono: 'JetBrains Mono', monospace; }
 *
 * Or import a theme:
 *   import { applyTheme, DARK_THEME } from 'duck-grid'
 *   applyTheme(DARK_THEME)
 */

import { BASE_STYLES, DARK_THEME } from './styles.js'

// ── style injection (once per page, not once per instance) ───────────────────
let stylesInjected = false
function injectStyles() {
  if (stylesInjected) return
  const el = document.createElement('style')
  el.setAttribute('data-duck-grid', '')
  el.textContent = BASE_STYLES
  document.head.appendChild(el)
  stylesInjected = true
}

/**
 * Inject an additional CSS string into the page.
 * Use this for theme overrides, e.g. applyTheme(DARK_THEME)
 */
export function applyTheme(css) {
  const el = document.createElement('style')
  el.setAttribute('data-duck-grid-theme', '')
  // remove previous theme if any - check for light
  document.head.querySelectorAll('[data-duck-grid-theme]').forEach(n => n.remove())
  el.textContent = css
  document.head.appendChild(el)
}

export { DARK_THEME }

// ── unique ID generator for multi-instance safety ────────────────────────────
let instanceCounter = 0

// ── DuckDB WASM singleton — shared across all instances ──────────────────────
let duckPromise = null
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

// ── helpers ──────────────────────────────────────────────────────────────────
const escSql  = s => String(s).replace(/'/g, "''")
const isNum   = v => typeof v === 'number' || typeof v === 'bigint'
const isBool  = v => typeof v === 'boolean'
const isDate  = v => v instanceof Date

// DuckDB WASM returns bigint for INT64 — normalise for display
const toNum = v => typeof v === 'bigint' ? Number(v) : v

// Columns that are good candidates for filter dropdowns:
// low cardinality = distinct count ≤ threshold relative to total rows
const FILTER_MAX_DISTINCT   = 200
const FILTER_MAX_RATIO      = 0.1   // at most 10% of total rows

// ── component ────────────────────────────────────────────────────────────────
class DuckGrid extends HTMLElement {

  // ── per-instance state ────────────────────────────────────────────────────
  #id         = ++instanceCounter        // unique suffix for this instance
  #conn       = null
  #viewName   = ''                       // unique view name e.g. "dg_view_1"
  #schema     = []                       // [{ name, type }]
  #filterCols = []                       // subset of schema chosen for dropdowns
  #searchCols = []                       // text columns for free-text search
  #filters    = {}                       // { colName: value }
  #search     = ''
  #page       = 0
  #pageSize   = 100
  #totalRows  = 0
  #sortCol    = null
  #sortDir    = 'ASC'
  #t          = { init: 0, file: 0, query: 0, render: 0 }
  #searchTimer = null

  // ── scoped DOM helpers (never touch document globally) ────────────────────
  #q  = sel => this.querySelector(sel)
  #id_el = suf => this.querySelector(`[data-dg="${this.#id}-${suf}"]`)

  connectedCallback() {
    injectStyles()
    this.#pageSize = Number(this.getAttribute('page-size') || 100)
    this.#viewName = `dg_view_${this.#id}`

    if (this.getAttribute('theme') === 'dark') applyTheme(DARK_THEME)
    if (this.getAttribute('height')) this.style.height = this.getAttribute('height')

    this.#render()
    this.#boot()
  }

  disconnectedCallback() {
    // clean up DuckDB connection and drop view
    if (this.#conn) {
      this.#conn.query(`DROP VIEW IF EXISTS "${this.#viewName}"`).catch(() => {})
      this.#conn.close().catch(() => {})
      this.#conn = null
    }
  }

  // ── static HTML shell (toolbar + table area + footer) ────────────────────
  #render() {
    const id = this.#id
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
          ${['init','file','query','render'].map(k => `
            <div class="dg-perf-chip">
              <span class="dg-perf-label">${k}</span>
              <span data-dg="${id}-t-${k}" class="dg-perf-value">—</span>
            </div>`).join('')}
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
              ${[25,50,100,250,500].map(n =>
                `<option value="${n}"${n === this.#pageSize ? ' selected' : ''}>${n}</option>`
              ).join('')}
            </select>
          </label>
        </div>

      </div>`

    this.#setupListeners()
  }

  // ── boot: init DuckDB → load file → detect schema → query ────────────────
  async #boot() {
    const src = this.getAttribute('src')
    if (!src) return this.#showError('src attribute is required')

    try {
      // 1. DuckDB init (shared singleton — fast if already loaded)
      this.#setMsg('initialising duckdb…')
      const t0_init = performance.now()
      const db = await getDuckDB()
      this.#t.init = Math.round(performance.now() - t0_init)

      // 2. Load file and create view
      this.#setMsg('loading file…')
      const t0_file = performance.now()
      this.#conn = await db.connect()

      const fileKey  = `dg_file_${this.#id}`
      const absUrl   = new URL(src, location.href).href
      const isCSV    = src.toLowerCase().endsWith('.csv')

      await db.registerFileURL(fileKey, absUrl, 4, false)

      // Create a uniquely named view per instance
      const scanFn = isCSV ? `read_csv_auto` : `parquet_scan`
      await this.#conn.query(
        `CREATE VIEW "${this.#viewName}" AS SELECT * FROM ${scanFn}('${fileKey}')`
      )
      this.#t.file = Math.round(performance.now() - t0_file)

      // 3. Detect schema from the view
      this.#setMsg('detecting schema…')
      await this.#detectSchema()

      // 4. Build filter dropdowns from schema
      this.#setMsg('building filters…')
      await this.#buildFilters()

      // 5. First query
      this.#setMsg('running query…')
      await this.#runQuery()

    } catch (err) {
      console.error('[DuckGrid]', err)
      this.#showError(err.message)
    }
  }

  // ── schema detection ──────────────────────────────────────────────────────
  async #detectSchema() {
    const res = await this.#conn.query(
      `DESCRIBE "${this.#viewName}"`
    )
    this.#schema = res.toArray().map(r => ({
      name:    r.column_name,
      rawType: r.column_type.toUpperCase(),
      kind:    this.#kindFromType(r.column_type),
    }))

    // Text columns are candidates for full-text search
    this.#searchCols = this.#schema
      .filter(c => c.kind === 'text')
      .map(c => c.name)
  }

  #kindFromType(t) {
    t = t.toUpperCase()
    if (/INT|BIGINT|HUGEINT|SMALLINT|TINYINT|UBIGINT|UINTEGER/.test(t)) return 'int'
    if (/FLOAT|DOUBLE|DECIMAL|NUMERIC|REAL/.test(t))                      return 'float'
    if (/BOOL/.test(t))                                                    return 'bool'
    if (/DATE|TIME|TIMESTAMP|INTERVAL/.test(t))                            return 'date'
    return 'text'
  }

  // ── build filter dropdowns dynamically from schema ────────────────────────
  async #buildFilters() {
    const container = this.#id_el('filters')
    container.innerHTML = ''
    this.#filterCols = []
    this.#filters    = {}

    // Check each text column's distinct count
    for (const col of this.#schema.filter(c => c.kind === 'text')) {
      const r = await this.#conn.query(
        `SELECT COUNT(DISTINCT "${col.name}") AS n FROM "${this.#viewName}"`
      )
      const distinct = Number(r.toArray()[0].n)
      const total    = this.#totalRows || distinct  // rough estimate first pass

      if (distinct <= FILTER_MAX_DISTINCT) {
        this.#filterCols.push(col.name)
        this.#filters[col.name] = ''

        // Build <select>
        const vals = await this.#conn.query(
          `SELECT DISTINCT "${col.name}" as v FROM "${this.#viewName}"
           WHERE "${col.name}" IS NOT NULL
           ORDER BY 1 LIMIT 500`
        )

        const sel = document.createElement('select')
        sel.className = 'dg-select'
        sel.dataset.dg = `${this.#id}-filter-${col.name}`

        const allOpt = document.createElement('option')
        allOpt.value = ''
        // Format: "All Region" from column name "region"
        allOpt.textContent = `All ${col.name.replace(/_/g,' ').replace(/\b\w/g, l => l.toUpperCase())}`
        sel.appendChild(allOpt)

        vals.toArray().forEach(row => {
          const o = document.createElement('option')
          o.value = o.textContent = String(row.v)
          sel.appendChild(o)
        })

        sel.addEventListener('change', e => {
          this.#filters[col.name] = e.target.value
          this.#page = 0
          this.#runQuery()
        })

        container.appendChild(sel)
      }
    }
  }

  // ── WHERE clause built from current filter + search state ─────────────────
  #buildWhere() {
    const conds = []

    // dropdown filters
    for (const [col, val] of Object.entries(this.#filters)) {
      if (val) conds.push(`"${col}" = '${escSql(val)}'`)
    }

    // full-text search across all text columns
    if (this.#search && this.#searchCols.length) {
      const s = escSql(this.#search)
      const parts = this.#searchCols.map(c => `"${c}" ILIKE '%${s}%'`)
      conds.push(`(${parts.join(' OR ')})`)
    }

    return conds.length ? `WHERE ${conds.join(' AND ')}` : ''
  }

  #buildOrderBy() {
    if (!this.#sortCol) return ''
    return `ORDER BY "${this.#sortCol}" ${this.#sortDir}`
  }

  // ── main query ────────────────────────────────────────────────────────────
  async #runQuery() {
    this.#showLoading(true)
    const where   = this.#buildWhere()
    const orderBy = this.#buildOrderBy()
    const offset  = this.#page * this.#pageSize

    const t0 = performance.now()

    const countRes = await this.#conn.query(
      `SELECT COUNT(*) AS n FROM "${this.#viewName}" ${where}`
    )
    this.#totalRows = Number(countRes.toArray()[0].n)

    const rows = await this.#conn.query(`
      SELECT * FROM "${this.#viewName}"
      ${where}
      ${orderBy}
      LIMIT ${this.#pageSize} OFFSET ${offset}
    `)
    this.#t.query = Math.round(performance.now() - t0)

    const t0r = performance.now()
    this.#renderTable(rows.toArray(), rows.schema.fields.map(f => f.name))
    this.#t.render = Math.round(performance.now() - t0r)

    this.#updateFooter()
    this.#updatePerfBar()
    this.#showLoading(false)
  }

  // ── render table rows ─────────────────────────────────────────────────────
  #renderTable(rows, cols) {
    const thead = this.#id_el('thead')
    const tbody = this.#id_el('tbody')
    const table = this.#id_el('table')

    // header
    thead.innerHTML = `<tr>${cols.map(c => {
      const sorted = this.#sortCol === c
      return `<th data-col="${c}" class="${sorted ? 'dg-sorted' : ''}">
        ${c.replace(/_/g,' ')}
        <span class="dg-sort-arrow">${sorted ? (this.#sortDir === 'ASC' ? '↑' : '↓') : '⇅'}</span>
      </th>`
    }).join('')}</tr>`

    thead.querySelectorAll('th').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.col
        if (this.#sortCol === col) {
          this.#sortDir = this.#sortDir === 'ASC' ? 'DESC' : 'ASC'
        } else {
          this.#sortCol = col
          this.#sortDir = 'ASC'
        }
        this.#page = 0
        this.#runQuery()
      })
    })

    // body
    tbody.innerHTML = rows.map(row => `<tr>${
      cols.map(c => this.#renderCell(row[c])).join('')
    }</tr>`).join('')

    table.style.display = ''
    this.#id_el('count').textContent = `${this.#totalRows.toLocaleString()} rows`
    this.#id_el('export').disabled = false
  }

  // ── cell rendering — type-aware ───────────────────────────────────────────
  #renderCell(v) {
    if (v === null || v === undefined) {
      return `<td class="dg-td-null">—</td>`
    }
    if (isBool(v)) {
      return `<td class="${v ? 'dg-td-bool-t' : 'dg-td-bool-f'}">${v ? 'true' : 'false'}</td>`
    }
    if (isNum(v)) {
      const n = toNum(v)
      const display = Number.isInteger(n) ? n.toLocaleString() : n.toFixed(2)
      return `<td class="dg-td-num">${display}</td>`
    }
    if (isDate(v)) {
      return `<td class="dg-td-date">${v.toISOString().slice(0, 10)}</td>`
    }
    // escape HTML for text cells
    const safe = String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    return `<td title="${safe}">${safe}</td>`
  }

  // ── footer / pagination ───────────────────────────────────────────────────
  #updateFooter() {
    const footer     = this.#id_el('footer')
    footer.style.display = ''
    const totalPages = Math.max(1, Math.ceil(this.#totalRows / this.#pageSize))
    this.#id_el('page-info').textContent = `${this.#page + 1} / ${totalPages}`
    this.#id_el('prev').disabled = this.#page === 0
    this.#id_el('next').disabled = this.#page >= totalPages - 1
  }

  // ── perf bar ──────────────────────────────────────────────────────────────
  #updatePerfBar() {
    const fmt = ms => {
      const cls = ms < 100 ? 'fast' : ms < 500 ? 'med' : 'slow'
      return { text: ms + 'ms', cls }
    }
    const set = (suf, ms) => {
      const el = this.#id_el(`t-${suf}`)
      const { text, cls } = fmt(ms)
      el.textContent = text
      el.className   = `dg-perf-value ${cls}`
    }
    set('init',   this.#t.init)
    set('file',   this.#t.file)
    set('query',  this.#t.query)
    set('render', this.#t.render)
    const total = Object.values(this.#t).reduce((a, b) => a + b, 0)
    const el    = this.#id_el('t-total')
    const { text, cls } = fmt(total)
    el.textContent = text
    el.className   = `dg-perf-value ${cls}`
    this.#id_el('perfbar').classList.add('visible')
  }

  // ── event listeners ───────────────────────────────────────────────────────
  #setupListeners() {
    this.#q('.dg-search').addEventListener('input', e => {
      clearTimeout(this.#searchTimer)
      this.#searchTimer = setTimeout(() => {
        this.#search = e.target.value.trim()
        this.#page   = 0
        if (this.#conn) this.#runQuery()
      }, 300)
    })

    this.#id_el('prev').addEventListener('click', () => {
      if (this.#page > 0) { this.#page--; this.#runQuery() }
    })
    this.#id_el('next').addEventListener('click', () => {
      if (this.#page < Math.ceil(this.#totalRows / this.#pageSize) - 1) {
        this.#page++; this.#runQuery()
      }
    })
    this.#id_el('page-size').addEventListener('change', e => {
      this.#pageSize = Number(e.target.value)
      this.#page     = 0
      if (this.#conn) this.#runQuery()
    })
    this.#id_el('export').addEventListener('click', () => this.#exportCSV())
  }

  // ── export ────────────────────────────────────────────────────────────────
  async #exportCSV() {
    // Export only the currently filtered/sorted set, in pages to avoid OOM
    const where   = this.#buildWhere()
    const orderBy = this.#buildOrderBy()
    const CHUNK   = 10_000
    let   offset  = 0
    const parts   = []
    let   headers = null

    while (true) {
      const res  = await this.#conn.query(
        `SELECT * FROM "${this.#viewName}" ${where} ${orderBy} LIMIT ${CHUNK} OFFSET ${offset}`
      )
      const rows = res.toArray()
      if (!rows.length) break
      if (!headers) {
        headers = Object.keys(rows[0])
        parts.push(headers.join(','))
      }
      parts.push(...rows.map(r =>
        headers.map(c => JSON.stringify(r[c] ?? '')).join(',')
      ))
      offset += CHUNK
      if (rows.length < CHUNK) break
    }

    const csv = parts.join('\n')
    const a   = document.createElement('a')
    a.href    = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const filename = this.getAttribute('src')?.split('/').pop()?.replace(/\.\w+$/, '') || 'export'
    a.download = `${filename}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
  }

  // ── loading state helpers ─────────────────────────────────────────────────
  #setMsg(msg) {
    this.#id_el('loading-msg').textContent = msg
    this.#showLoading(true)
  }

  #showLoading(on) {
    const el = this.#id_el('loading')
    if (el) el.style.display = on ? '' : 'none'
  }

  #showError(msg) {
    const el = this.#id_el('loading')
    if (el) el.innerHTML =
      `<span class="dg-loading-error">⚠ ${msg}</span>`
  }
}

customElements.define('duck-grid', DuckGrid)
