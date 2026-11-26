// Small view building blocks shared by the home screen and the course sheet.
import { h } from './dom.js';

const pct = (fraction) => Math.round(Math.min(1, Math.max(0, fraction)) * 100);

/**
 * Two-layer bar from lectureProgress(): a faint layer for lectures out (the
 * course's pace) under a solid layer for lectures watched (yours).
 */
export const progressBar = (progress, extraClass = '') => h('div', {
  class: `progress ${extraClass}`,
  role: 'progressbar',
  'aria-valuenow': pct(progress.watched),
  'aria-valuemin': 0,
  'aria-valuemax': 100,
  'aria-valuetext': progress.label,
},
h('div', { class: 'progress-out', style: `width:${pct(progress.out)}%` }),
h('div', { class: 'progress-fill', style: `width:${pct(progress.watched)}%` }));

const stopThen = (fn) => (e) => { e.stopPropagation(); fn(); };

/** −/+1 stepper, like UIStepper. Clicks don't reach a tappable parent row. */
export const stepButtons = ({ minusLabel, plusLabel, canMinus, canPlus, onMinus, onPlus }) => h('div', { class: 'steps' },
  h('button', { class: 'step minus', type: 'button', 'aria-label': minusLabel, disabled: !canMinus, onClick: stopThen(onMinus) }, '−'),
  h('button', { class: 'step plus', type: 'button', 'aria-label': plusLabel, disabled: !canPlus, onClick: stopThen(onPlus) }, '+1'));
