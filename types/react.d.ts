import type { DuckGridAttributes } from "./index";
import * as React from "react";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "duck-grid": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & DuckGridAttributes,
        HTMLElement
      >;
    }
  }
}
