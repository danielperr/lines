// Small view building blocks shared by the home screen and the course sheet.
import { h } from './dom.js';

export const progressBar = (fraction, extraClass = '') => {
  const pct = Math.round(Math.min(1, Math.max(0, fraction)) * 100);
  return h('div', { class: `progress ${extraClass}`, role: 'progressbar', 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100 },
    h('div', { class: 'progress-fill', style: `width:${pct}%` }));
};

const stopThen = (fn) => (e) => { e.stopPropagation(); fn(); };

/** −/+1 stepper, like UIStepper. Clicks don't reach a tappable parent row. */
export const stepButtons = ({ minusLabel, plusLabel, canMinus, canPlus, onMinus, onPlus }) => h('div', { class: 'steps' },
  h('button', { class: 'step minus', type: 'button', 'aria-label': minusLabel, disabled: !canMinus, onClick: stopThen(onMinus) }, '−'),
  h('button', { class: 'step plus', type: 'button', 'aria-label': plusLabel, disabled: !canPlus, onClick: stopThen(onPlus) }, '+1'));
