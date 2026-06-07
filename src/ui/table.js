import { renderCell } from "../utils/cell.js";

export function renderTableHeader(cols, sortCol, sortDir, filters) {
  return `<tr>${cols.map((c) => {
    const sorted = sortCol === c;
    const active = filters[c]?.length > 0;
    return `
      <th data-col="${c}" class="${sorted ? "dg-sorted" : ""}">
        <div class="dg-header">
          <span class="dg-col-label">${c.replace(/_/g, " ")}</span>
          <button class="dg-filter-btn ${active ? "active" : ""}" data-filter-col="${c}">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 5h16v1l-6.5 7.5v5l-3 2v-7L4 6V5z"/>
            </svg>
          </button>
        </div>
      </th>`;
  }).join("")}</tr>`;
}

export function renderTableBody(rows, cols) {
  return rows
    .map(
      (row) =>
        `<tr>${cols.map((c) => renderCell(row[c])).join("")}</tr>`,
    )
    .join("");
}
