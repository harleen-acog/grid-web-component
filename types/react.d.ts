import type { DuckGridElement, DuckGridAttributes } from "./index";
import * as React from "react";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "duck-grid": React.DetailedHTMLProps<
        React.HTMLAttributes<DuckGridElement>,
        DuckGridElement
      > &
        DuckGridAttributes;
    }
  }
}
