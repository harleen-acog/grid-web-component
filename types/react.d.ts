import type { DuckGridAttributes } from "./index";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "duck-grid": DuckGridAttributes;
    }
  }
}
