// Editable "break" rows (holidays with no lectures), shared by the track dialog
// and the course wizard. An empty To means a single day.

import { h } from './dom.js';

export const breakRow = ({ from, to }, onChange) => {
  const row = h('div', { class: 'break-row group' },
    h('div', { class: 'break-head' },
      h('span', {}, 'Break'),
      h('button', {
        class: 'btn-plain destructive',
        type: 'button',
        onClick: () => { row.remove(); onChange(); },
      }, 'Remove')),
    h('div', { class: 'row' },
      h('label', {}, 'From', h('input', { type: 'date', 'data-break': 'from', value: from })),
      h('label', {}, 'To', h('input', { type: 'date', 'data-break': 'to', value: to === from ? '' : to }))));
  return row;
};

/** Rows with no dates at all are ignored; a missing To copies From. */
export const readBreaks = (container) => [...container.querySelectorAll('.break-row')]
  .map((row) => ({
    from: row.querySelector('[data-break="from"]').value,
    to: row.querySelector('[data-break="to"]').value,
  }))
  .filter((b) => b.from || b.to)
  .map((b) => ({ from: b.from || b.to, to: b.to || b.from }));

/** Wires an "+ Add break" button to append a row and focus it. */
export const wireAddBreak = (button, container, onChange) => {
  button.addEventListener('click', () => {
    const row = breakRow({ from: '', to: '' }, onChange);
    container.append(row);
    row.querySelector('input').focus();
  });
};
