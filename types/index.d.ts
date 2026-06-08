export interface DuckGridAttributes {
  src?: string;
  "page-size"?: string | number;
  theme?: "light" | "dark";
  height?: string;
}

export declare class DuckGridElement extends HTMLElement {
  static readonly observedAttributes: string[];
}

export function applyTheme(css: string): void;
export const DARK_THEME: string;

export function getDuckDB(): Promise<any>;

export function detectSchema(
  conn: any,
  viewName: string,
): Promise<{
  schema: Array<{ name: string; rawType: string; kind: string; operators: string[] }>;
  searchCols: string[];
}>;

export function kindFromType(t: string): string;
export function operatorsForKind(kind: string): string[];

export function buildWhere(
  schema: Array<{ name: string; kind: string }>,
  filters: Record<string, Array<{ op: string; value: string }>>,
  search: string,
  searchCols: string[],
): string;

export function buildOrderBy(sortCol: string | null, sortDir: string): string;

export function conditionToSql(
  column: string,
  kind: string,
  condition: { op: string; value: string },
): string | null;

export function renderCell(v: unknown): string;
export function escSql(s: string): string;

export function exportCSV(
  conn: any,
  viewName: string,
  where: string,
  orderBy: string,
): Promise<string>;

export class FilterDialog {
  el: HTMLElement | null;
  open(params: {
    column: string;
    kind: string;
    operators: string[];
    filters?: Array<{ op: string; value: string }>;
    anchor: HTMLElement;
    host?: HTMLElement;
  }): Promise<Array<{ op: string; value: string }> | null>;
}

export class FilterPopover {
  constructor(options: {
    column: { name: string; kind: string; rawType?: string; distinctValues?: any[]; min?: number; max?: number };
    currentValue?: Record<string, any>;
    anchorEl: HTMLElement;
    onApply: (val: any) => void;
    onClear: () => void;
  });
  show(): void;
  close(): void;
  static closeAll(): void;
}

declare global {
  interface HTMLElementTagNameMap {
    "duck-grid": DuckGridElement;
  }
}
