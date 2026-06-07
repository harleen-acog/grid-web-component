export function renderToolbar(id) {
  return `
    <div class="dg-toolbar">
      <div class="dg-toolbar-left">
        <div class="dg-search-wrap">
          <svg class="dg-search-icon" width="15" height="15" viewBox="0 0 24 24"
               fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input data-dg="${id}-search" class="dg-search" type="text"
                 placeholder="Search" autocomplete="off" />
        </div>
      </div>
      <div class="dg-toolbar-right">
        <button data-dg="${id}-export" class="dg-btn dg-btn-export" disabled title="Export as CSV">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </button>
        <span data-dg="${id}-count" class="dg-count"></span>
      </div>
    </div>`;
}

export function renderPerfBar(id, timings) {
  const fmt = (ms) => {
    const cls = ms < 100 ? "fast" : ms < 500 ? "med" : "slow";
    return { text: ms + "ms", cls };
  };
  const total = Object.values(timings).reduce((a, b) => a + b, 0);

  return `
    <div data-dg="${id}-perfbar" class="dg-perfbar${total > 0 ? ' visible' : ''}">
      ${["init", "file", "query", "render"].map((k) => {
        const { text, cls } = fmt(timings[k] || 0);
        return `
          <div class="dg-perf-chip">
            <span class="dg-perf-label">${k}</span>
            <span data-dg="${id}-t-${k}" class="dg-perf-value ${cls}">${text}</span>
          </div>`;
      }).join("")}
      <div class="dg-perf-chip dg-perf-total">
        <span class="dg-perf-label">Total</span>
        <span data-dg="${id}-t-total" class="dg-perf-value ${fmt(total).cls}">${fmt(total).text}</span>
      </div>
      <div class="dg-perf-engine">DuckDB WASM</div>
    </div>`;
}

export function renderFooter(id, page, totalRows, pageSize) {
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  return `
    <div data-dg="${id}-footer" class="dg-footer" style="${totalRows ? '' : 'display:none'}">
      <button data-dg="${id}-prev" class="dg-btn" ${page === 0 ? 'disabled' : ''}>← prev</button>
      <span data-dg="${id}-page-info" class="dg-page-info">${page + 1} / ${totalPages}</span>
      <button data-dg="${id}-next" class="dg-btn" ${page >= totalPages - 1 ? 'disabled' : ''}>next →</button>
      <span class="dg-sep"></span>
      <label class="dg-page-size-label">
        rows
        <select data-dg="${id}-page-size" class="dg-select">
          ${[25, 50, 100, 250, 500].map((n) =>
            `<option value="${n}"${n === pageSize ? " selected" : ""}>${n}</option>`
          ).join("")}
        </select>
      </label>
    </div>`;
}
