import type { DuckGridAttributes } from "./index";

declare module "vue" {
  interface GlobalComponents {
    "duck-grid": DuckGridAttributes;
  }
}
