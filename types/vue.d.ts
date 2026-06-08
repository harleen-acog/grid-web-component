import type { DuckGridElement } from "./index";

declare module "vue" {
  interface GlobalComponents {
    "duck-grid": DuckGridElement;
  }
}
