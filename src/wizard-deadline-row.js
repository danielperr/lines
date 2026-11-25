// One exam/assignment row in the course wizard. Values live in the DOM until
// readDeadline() turns a row back into a draft deadline.

import { h } from './dom.js';
import { deadlineLabels, kindLabel } from './course-wizard.js';

const AMOUNT = Object.freeze({
  exam: { label: 'Chapters of prep', placeholder: 'Optional' },
  assignment: { label: 'Days of work', placeholder: 'Optional' },
});
const TITLE_PLACEHOLDER = Object.freeze({ exam: 'e.g. Midterm', assignment: 'e.g. HW1' });

const field = (row, name) => row.querySelector(`[name="${name}"]`);

/** Updates the heading numbers ("Exam 1", "Assignment 2") after rows change. */
export const renumberRows = (container) => {
  const rows = [...container.querySelectorAll('.wizard-deadline')];
  const labels = deadlineLabels(rows.map((row) => row.dataset.kind));
  rows.forEach((row, i) => { row.querySelector('.wizard-deadline-title').textContent = labels[i]; });
};

export const deadlineRow = (deadline, { onRemove }) => {
  const { kind } = deadline;
  const row = h('fieldset', { class: 'wizard-deadline group', dataset: { kind } },
    h('div', { class: 'break-head' },
      h('span', { class: 'wizard-deadline-title' }, kindLabel(kind)),
      h('button', { class: 'btn-plain destructive', type: 'button', onClick: () => onRemove(row) }, 'Remove')),
    h('label', {}, 'Title',
      h('input', { name: 'title', dir: 'auto', maxlength: 80, value: deadline.title, placeholder: TITLE_PLACEHOLDER[kind] })),
    h('div', { class: 'row' },
      h('label', {}, 'Due date', h('input', { name: 'due', type: 'date', value: deadline.due })),
      h('label', {}, AMOUNT[kind].label,
        h('input', {
          name: 'amount', type: 'number', inputmode: 'numeric', min: 1, step: 1,
          value: deadline.amount, placeholder: AMOUNT[kind].placeholder,
        }))));
  return row;
};

export const readDeadline = (row) => ({
  kind: row.dataset.kind,
  title: field(row, 'title').value,
  due: field(row, 'due').value,
  amount: field(row, 'amount').value.trim(),
});
