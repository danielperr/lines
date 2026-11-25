// Tapping the dimmed area around an open sheet tries to close it, like
// Escape: the unsaved-changes guard still gets to ask. A tap counts only when
// it both starts and ends outside, so a text selection dragged out of the
// sheet does not close it.

import { requestClose } from './sheet-swipe.js';

/** Whether `point` lies outside `rect` (edges count as inside). */
export const isOutside = (rect, { x, y }) => x < rect.left || x > rect.right || y < rect.top || y > rect.bottom;

const pointOf = (e) => ({ x: e.clientX, y: e.clientY });

/** Lets a tap on `dialog`'s backdrop ask it to close. */
export const enableBackdropClose = (dialog) => {
  let pressedOutside = false;
  dialog.addEventListener('pointerdown', (e) => {
    pressedOutside = e.target === dialog && isOutside(dialog.getBoundingClientRect(), pointOf(e));
  });
  dialog.addEventListener('click', (e) => {
    const outside = e.target === dialog && isOutside(dialog.getBoundingClientRect(), pointOf(e));
    if (outside && pressedOutside) requestClose(dialog);
    pressedOutside = false;
  });
};
