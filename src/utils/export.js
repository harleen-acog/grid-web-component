const CHUNK = 10_000;

export async function exportCSV(conn, viewName, where, orderBy) {
  let offset = 0;
  const parts = [];
  let headers = null;

  while (true) {
    const res = await conn.query(
      `SELECT * FROM "${viewName}" ${where} ${orderBy} LIMIT ${CHUNK} OFFSET ${offset}`,
    );
    const rows = res.toArray();
    if (!rows.length) break;
    if (!headers) {
      headers = Object.keys(rows[0]);
      parts.push(headers.join(","));
    }
    parts.push(
      ...rows.map((r) =>
        headers.map((c) => JSON.stringify(r[c] ?? "")).join(","),
      ),
    );
    offset += CHUNK;
    if (rows.length < CHUNK) break;
  }

  return parts.join("\n");
}
