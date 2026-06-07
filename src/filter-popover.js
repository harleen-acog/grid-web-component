/**
 * filter-popover.js
 * A standalone, reusable popover filter module.
 * Cleanly decoupled from the grid implementation and DuckDB.
 */

export class FilterPopover {
  constructor({ column, currentValue, anchorEl, onApply, onClear }) {
    this.column = column; // { name, kind, rawType, distinctValues, min, max }
    this.currentValue = currentValue || {};
    this.anchorEl = anchorEl;
    this.onApply = onApply;
    this.onClear = onClear;
    this.popoverEl = null;
    this._onOutsideClick = this._onOutsideClick.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
  }

  show() {
    // Close any open popovers first
    FilterPopover.closeAll();

    // Create popover element
    const el = document.createElement('div');
    el.className = 'dg-popover';
    el.setAttribute('data-dg-popover', '');
    
    // Set column info as attribute for potential styling/debugging
    el.setAttribute('data-col-name', this.column.name);
    el.setAttribute('data-col-kind', this.column.kind);

    // Build internal HTML structure
    const formattedTitle = this.column.name
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());

    let contentHtml = '';

    if (this.column.kind === 'text') {
      const distinct = this.column.distinctValues;
      const hasDistinct = Array.isArray(distinct) && distinct.length > 0;
      
      contentHtml = `
        <div class="dg-popover-field">
          <label class="dg-popover-label">Contains</label>
          <input type="text" class="dg-popover-input dg-popover-contains" 
                 placeholder="Search text..." 
                 value="${this.currentValue.contains || ''}" />
        </div>
      `;

      if (hasDistinct) {
        const options = distinct
          .map(v => {
            const selected = this.currentValue.val === v ? 'selected' : '';
            const safeVal = String(v).replace(/"/g, '&quot;');
            return `<option value="${safeVal}" ${selected}>${v}</option>`;
          })
          .join('');

        contentHtml += `
          <div class="dg-popover-field">
            <label class="dg-popover-label">Equals</label>
            <select class="dg-popover-select dg-popover-val">
              <option value="">All values</option>
              ${options}
            </select>
          </div>
        `;
      }
    } else if (this.column.kind === 'bool') {
      contentHtml = `
        <div class="dg-popover-field">
          <label class="dg-popover-label">Value</label>
          <select class="dg-popover-select dg-popover-val">
            <option value="" ${!this.currentValue.val ? 'selected' : ''}>All</option>
            <option value="true" ${this.currentValue.val === 'true' ? 'selected' : ''}>True</option>
            <option value="false" ${this.currentValue.val === 'false' ? 'selected' : ''}>False</option>
          </select>
        </div>
      `;
    } else if (this.column.kind === 'int' || this.column.kind === 'float') {
      const step = this.column.kind === 'float' ? 'any' : '1';
      contentHtml = `
        <div class="dg-popover-field">
          <label class="dg-popover-label">Range</label>
          <div class="dg-popover-range-row">
            <input type="number" step="${step}" class="dg-popover-input dg-popover-min" 
                   placeholder="Min (${this.column.min !== undefined ? this.column.min : 'any'})" 
                   value="${this.currentValue.min !== undefined ? this.currentValue.min : ''}" />
            <span class="dg-popover-range-to">to</span>
            <input type="number" step="${step}" class="dg-popover-input dg-popover-max" 
                   placeholder="Max (${this.column.max !== undefined ? this.column.max : 'any'})" 
                   value="${this.currentValue.max !== undefined ? this.currentValue.max : ''}" />
          </div>
        </div>
      `;
    } else if (this.column.kind === 'date') {
      contentHtml = `
        <div class="dg-popover-field">
          <label class="dg-popover-label">Date Range</label>
          <div class="dg-popover-range-row">
            <input type="date" class="dg-popover-input dg-popover-from" 
                   value="${this.currentValue.from || ''}" />
            <span class="dg-popover-range-to">to</span>
            <input type="date" class="dg-popover-input dg-popover-to" 
                   value="${this.currentValue.to || ''}" />
          </div>
        </div>
      `;
    }

    el.innerHTML = `
      <div class="dg-popover-header">
        <span class="dg-popover-title">Filter by <strong>${formattedTitle}</strong></span>
      </div>
      <div class="dg-popover-body">
        ${contentHtml}
      </div>
      <div class="dg-popover-actions">
        <button class="dg-popover-btn dg-popover-btn-clear">Clear</button>
        <button class="dg-popover-btn dg-popover-btn-apply">Apply</button>
      </div>
    `;

    document.body.appendChild(el);
    this.popoverEl = el;

    // Position the popover
    this._position();

    // Wire up events
    el.querySelector('.dg-popover-btn-apply').addEventListener('click', () => this._apply());
    el.querySelector('.dg-popover-btn-clear').addEventListener('click', () => this._clear());

    // Stop propagation of clicks inside popover to prevent triggering outside click
    el.addEventListener('click', e => e.stopPropagation());

    // Bind outside clicks and Escape key
    setTimeout(() => {
      document.addEventListener('click', this._onOutsideClick);
      document.addEventListener('keydown', this._onKeyDown);
    }, 0);
  }

  close() {
    if (this.popoverEl) {
      this.popoverEl.remove();
      this.popoverEl = null;
    }
    document.removeEventListener('click', this._onOutsideClick);
    document.removeEventListener('keydown', this._onKeyDown);
  }

  static closeAll() {
    document.querySelectorAll('[data-dg-popover]').forEach(el => el.remove());
  }

  _position() {
    if (!this.popoverEl || !this.anchorEl) return;

    const rect = this.anchorEl.getBoundingClientRect();
    const popoverWidth = 260; // Fixed width for clean look

    // Calculate absolute positions with scroll offset
    let left = rect.left + window.scrollX;
    let top = rect.bottom + window.scrollY + 6;

    // If popover goes off the right edge of the screen, align it to the right of anchor
    if (left + popoverWidth > window.innerWidth) {
      left = rect.right + window.scrollX - popoverWidth;
    }

    // Keep it on screen left boundary
    if (left < 0) left = 6;

    this.popoverEl.style.position = 'absolute';
    this.popoverEl.style.zIndex = '9999';
    this.popoverEl.style.width = `${popoverWidth}px`;
    this.popoverEl.style.left = `${left}px`;
    this.popoverEl.style.top = `${top}px`;
  }

  _apply() {
    const filterVal = { type: this.column.kind };

    if (this.column.kind === 'text') {
      const containsEl = this.popoverEl.querySelector('.dg-popover-contains');
      const valEl = this.popoverEl.querySelector('.dg-popover-val');
      
      filterVal.contains = containsEl ? containsEl.value.trim() : '';
      filterVal.val = valEl ? valEl.value : '';
      
      if (!filterVal.contains && !filterVal.val) {
        this._clear();
        return;
      }
    } else if (this.column.kind === 'bool') {
      const valEl = this.popoverEl.querySelector('.dg-popover-val');
      filterVal.val = valEl ? valEl.value : '';
      
      if (!filterVal.val) {
        this._clear();
        return;
      }
    } else if (this.column.kind === 'int' || this.column.kind === 'float') {
      const minEl = this.popoverEl.querySelector('.dg-popover-min');
      const maxEl = this.popoverEl.querySelector('.dg-popover-max');
      
      filterVal.min = minEl ? minEl.value.trim() : '';
      filterVal.max = maxEl ? maxEl.value.trim() : '';

      if (filterVal.min === '' && filterVal.max === '') {
        this._clear();
        return;
      }
    } else if (this.column.kind === 'date') {
      const fromEl = this.popoverEl.querySelector('.dg-popover-from');
      const toEl = this.popoverEl.querySelector('.dg-popover-to');
      
      filterVal.from = fromEl ? fromEl.value : '';
      filterVal.to = toEl ? toEl.value : '';

      if (!filterVal.from && !filterVal.to) {
        this._clear();
        return;
      }
    }

    if (this.onApply) {
      this.onApply(filterVal);
    }
    this.close();
  }

  _clear() {
    if (this.onClear) {
      this.onClear();
    }
    this.close();
  }

  _onOutsideClick(e) {
    if (this.popoverEl && !this.popoverEl.contains(e.target) && !this.anchorEl.contains(e.target)) {
      this.close();
    }
  }

  _onKeyDown(e) {
    if (e.key === 'Escape') {
      this.close();
    } else if (e.key === 'Enter') {
      // Trigger apply on Enter key
      this._apply();
    }
  }
}
