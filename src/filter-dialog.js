export class FilterDialog {

  constructor() {
    this.el = null
  }

  open({
    column,
    kind,
    operators,
    filters = [],
    anchor,
    host
  }) {

    return new Promise(resolve => {

      if (this.el) {
        this.el.remove()
      }

      const existing =
        filters[0] || {}

      const root =
        document.createElement('div')

      root.className =
        'dg-filter-dialog'

      root.innerHTML = `
        <div class="dg-filter-title">
          ${column}
        </div>

        <div class="dg-filter-condition">

          <select class="dg-op">

            ${operators.map(op => `
              <option
                value="${op}"
                ${existing.op === op ? 'selected' : ''}
              >
                ${op}
              </option>
            `).join('')}

          </select>

          <input
            class="dg-value"
            type="text"
            placeholder="value"
            value="${existing.value ?? ''}"
          />

        </div>

        <div class="dg-filter-actions">

          <button class="dg-apply">
            Apply
          </button>

          <button class="dg-clear">
            Clear
          </button>

          <button class="dg-cancel">
            Cancel
          </button>

        </div>
      `

      ;(host || document.body).appendChild(root)

      const rect =
        anchor.getBoundingClientRect()

      root.style.position =
        'fixed'

      root.style.top =
        `${rect.bottom + 4}px`

      const popupWidth =
        root.offsetWidth

      root.style.left =
        `${Math.max(8, rect.right - popupWidth)}px`

      this.el = root

      let close

      const cleanup = () => {

        document.removeEventListener(
          'click',
          close
        )

        root.remove()

        this.el = null
      }

      setTimeout(() => {

        close = e => {

          if (!root.contains(e.target)) {

            cleanup()

            resolve(null)
          }
        }

        document.addEventListener(
          'click',
          close
        )

      })

      root
        .querySelector('.dg-apply')
        .addEventListener('click', () => {

          const op =
            root.querySelector('.dg-op').value

          const value =
            root.querySelector('.dg-value').value

          cleanup()

          resolve([
            {
              op,
              value
            }
          ])
        })

      root
        .querySelector('.dg-clear')
        .addEventListener('click', () => {

          cleanup()

          resolve([])
        })

      root
        .querySelector('.dg-cancel')
        .addEventListener('click', () => {

          cleanup()

          resolve(null)
        })

    })
  }
}
