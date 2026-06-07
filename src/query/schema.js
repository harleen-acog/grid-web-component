export function kindFromType(t) {
  t = t.toUpperCase();
  if (/INT|BIGINT|HUGEINT|SMALLINT|TINYINT|UBIGINT|UINTEGER/.test(t))
    return "int";
  if (/FLOAT|DOUBLE|DECIMAL|NUMERIC|REAL/.test(t)) return "float";
  if (/BOOL/.test(t)) return "bool";
  if (/DATE|TIME|TIMESTAMP|INTERVAL/.test(t)) return "date";
  return "text";
}

export function operatorsForKind(kind) {
  switch (kind) {
    case "text":
      return ["=", "!=", "contains", "startsWith", "endsWith"];

    case "int":
    case "float":
      return ["=", "!=", ">", ">=", "<", "<=", "between"];

    case "date":
      return ["=", "!=", ">", "<", "between"];

    case "bool":
      return ["=", "!="];

    default:
      return ["="];
  }
}

export async function detectSchema(conn, viewName) {
  const res = await conn.query(`DESCRIBE "${viewName}"`);
  const schema = res.toArray().map((r) => {
    const kind = kindFromType(r.column_type);
    return {
      name: r.column_name,
      rawType: r.column_type.toUpperCase(),
      kind,
      operators: operatorsForKind(kind),
    };
  });

  const searchCols = schema
    .filter((c) => c.kind === "text")
    .map((c) => c.name);

  return { schema, searchCols };
}
