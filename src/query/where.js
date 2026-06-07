import { escSql } from "../utils/sql.js";

export function conditionToSql(column, kind, condition) {
  const op = condition.op;

  switch (op) {
    case "=":
      return kind === "text"
        ? `"${column}" = '${escSql(condition.value)}'`
        : `"${column}" = ${condition.value}`;

    case "!=":
      return kind === "text"
        ? `"${column}" <> '${escSql(condition.value)}'`
        : `"${column}" <> ${condition.value}`;

    case ">":
      return `"${column}" > ${condition.value}`;

    case ">=":
      return `"${column}" >= ${condition.value}`;

    case "<":
      return `"${column}" < ${condition.value}`;

    case "<=":
      return `"${column}" <= ${condition.value}`;

    case "contains":
      return `"${column}" ILIKE '%${escSql(condition.value)}%'`;

    case "startsWith":
      return `"${column}" ILIKE '${escSql(condition.value)}%'`;

    case "endsWith":
      return `"${column}" ILIKE '%${escSql(condition.value)}'`;

    default:
      return null;
  }
}

export function buildWhere(schema, filters, search, searchCols) {
  const conds = [];

  for (const [column, filterList] of Object.entries(filters)) {
    const meta = schema.find((c) => c.name === column);
    if (!meta) continue;

    for (const filter of filterList) {
      const sql = conditionToSql(column, meta.kind, filter);
      if (sql) {
        conds.push(sql);
      }
    }
  }

  if (search && searchCols.length) {
    const s = escSql(search);
    const parts = searchCols.map((c) => `"${c}" ILIKE '%${s}%'`);
    conds.push(`(${parts.join(" OR ")})`);
  }

  return conds.length ? `WHERE ${conds.join(" AND ")}` : "";
}

export function buildOrderBy(sortCol, sortDir) {
  if (!sortCol) return "";
  return `ORDER BY "${sortCol}" ${sortDir}`;
}
