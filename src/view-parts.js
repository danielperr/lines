// Small view building blocks shared by deadline cards and track cards.
import { h, formatDate, formatHours } from './dom.js';

const STATUS_LABEL = { overdue: 'Overdue', behind: 'Behind', tight: 'Tight', ok: 'On track', done: 'Done' };

export const unitLabel = (count, unit) => (count === 1 ? unit.replace(/s$/, '') : unit);

export const statusPill = (status, text = STATUS_LABEL[status]) => h('span', { class: `pill pill-${status}` }, text);

export const slackText = (item) => {
  if (item.status === 'overdue') return `Past due · ${formatHours(item.hoursLeft)} unfinished`;
  if (item.slackHours < 0) return `Short by ${formatHours(-item.slackHours)} — start now`;
  const days = Math.floor(item.slackDays);
  const spare = days >= 1 ? `${days}d spare` : `${formatHours(item.slackHours)} spare`;
  return `${spare} · start by ${formatDate(item.startBy)}`;
};

export const progressBar = (fraction, extraClass = '') => {
  const pct = Math.round(Math.min(1, Math.max(0, fraction)) * 100);
  return h('div', { class: `progress ${extraClass}`, role: 'progressbar', 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100 },
    h('div', { class: 'progress-fill', style: `width:${pct}%` }));
};

const stopThen = (fn) => (e) => { e.stopPropagation(); fn(); };

export const stepButtons = ({ minusLabel, plusLabel, canMinus, canPlus, onMinus, onPlus }) => h('div', { class: 'steps' },
  h('button', { class: 'step minus', type: 'button', 'aria-label': minusLabel, disabled: !canMinus, onClick: stopThen(onMinus) }, '−'),
  h('button', { class: 'step plus', type: 'button', 'aria-label': plusLabel, disabled: !canPlus, onClick: stopThen(onPlus) }, '+1'));
