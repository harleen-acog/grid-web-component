import { isBool, isNum, isDate, toNum } from "./sql.js";

export function renderCell(v) {
  if (v === null || v === undefined) {
    return `<td class="dg-td-null">—</td>`;
  }
  if (isBool(v)) {
    return `<td class="${v ? "dg-td-bool-t" : "dg-td-bool-f"}">${v ? "true" : "false"}</td>`;
  }
  if (isNum(v)) {
    const n = toNum(v);
    const display = Number.isInteger(n) ? n.toLocaleString() : n.toFixed(2);
    return `<td class="dg-td-num">${display}</td>`;
  }
  if (isDate(v)) {
    return `<td class="dg-td-date">${v.toISOString().slice(0, 10)}</td>`;
  }
  const safe = String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<td title="${safe}">${safe}</td>`;
}
