export const escSql = (s) => String(s).replace(/'/g, "''");

export const isNum = (v) => typeof v === "number" || typeof v === "bigint";

export const isBool = (v) => typeof v === "boolean";

export const isDate = (v) => v instanceof Date;

export const toNum = (v) => (typeof v === "bigint" ? Number(v) : v);
