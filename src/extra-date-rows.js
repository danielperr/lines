// Editable "extra lecture" rows (make-up lectures on specific dates), shared by
// the track dialog and the course wizard.

import { h } from './dom.js';

export const extraDateRow = (iso, onChange) => {
  const row = h('div', { class: 'extra-row' },
    h('label', {}, 'Extra lecture', h('input', { type: 'date', 'data-extra': 'date', value: iso })),
    h('button', {
      class: 'link-btn',
      type: 'button',
      'aria-label': 'Remove this extra lecture',
      onClick: () => { row.remove(); onChange(); },
    }, 'Remove'));
  return row;
};

/** Dates of every filled-in row, oldest first; empty rows are ignored. */
export const readExtraDates = (container) => [...container.querySelectorAll('[data-extra="date"]')]
  .map((input) => input.value)
  .filter(Boolean)
  .sort();

/** Fills the container with one row per date. */
export const fillExtraDates = (container, dates, onChange) => {
  container.replaceChildren(...(dates ?? []).map((iso) => extraDateRow(iso, onChange)));
};

/** Wires an "+ Add extra lecture" button to append a row and focus it. */
export const wireAddExtraDate = (button, container, onChange) => {
  button.addEventListener('click', () => {
    const row = extraDateRow('', onChange);
    container.append(row);
    row.querySelector('input').focus();
  });
};
