import baseCss from './base.css?raw'
import darkCss from './themes.css?raw'

let stylesInjected = false

export const BASE_STYLES = baseCss
export const DARK_THEME = darkCss

export function injectStyles() {
  if (stylesInjected) return
  const el = document.createElement("style")
  el.setAttribute("data-duck-grid", "")
  el.textContent = BASE_STYLES
  document.head.appendChild(el)
  stylesInjected = true
}

export function applyTheme(css) {
  const el = document.createElement("style")
  el.setAttribute("data-duck-grid-theme", "")
  document.head
    .querySelectorAll("[data-duck-grid-theme]")
    .forEach((n) => n.remove())
  el.textContent = css
  document.head.appendChild(el)
}
