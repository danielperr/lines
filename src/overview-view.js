import { h, formatHours, formatShortDate } from './dom.js';
import { courseKey, courseOverview, statusText } from './overview.js';
import { progressBar } from './view-parts.js';

const rowDetail = (row) => {
  if (row.status === 'done') return '';
  const due = row.nextDue ? ` · ${formatShortDate(row.nextDue)}` : '';
  return `${formatHours(row.hoursLeft)}${due}`;
};

const rowLabel = (row) => {
  const word = statusText(row);
  const detail = rowDetail(row);
  return h('span', { class: 'overview-label' },
    word ? h('span', { class: 'overview-word' }, word) : null,
    word && detail ? ' · ' : null,
    detail);
};

const overviewRow = (row, onJump) => h('button', {
  class: `overview-row status-${row.status}`,
  type: 'button',
  'aria-label': `${row.name}: ${[statusText(row) ?? 'On track', rowDetail(row)].filter(Boolean).join(', ')}. Show cards.`,
  onClick: () => onJump(courseKey(row.name)),
},
h('span', { class: 'overview-name' }, row.name),
progressBar(row.totalHours ? row.doneHours / row.totalHours : 1, 'thin'),
rowLabel(row));

/** Compact one-line-per-course status bars; null when there is nothing to show. */
export const overviewSection = (plan, onJump) => {
  const rows = courseOverview(plan);
  if (rows.length === 0) return null;
  return h('section', { class: 'overview', 'aria-label': 'Courses at a glance' },
    h('div', { class: 'overview-list' }, rows.map((row) => overviewRow(row, onJump))));
};
