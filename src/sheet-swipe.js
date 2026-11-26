// Swipe down to close a bottom sheet, as on iOS. A drag starts on the header
// (the bar with Cancel and Save) at any time, or anywhere once the sheet is
// scrolled to the top. Letting go closes the sheet only when the finger is
// still moving down fast (a flick), or after dragging it most of the way
// down; otherwise it springs back up. Closing goes through the dialog's
// `cancel` event, so the unsaved-changes guard still gets to ask, and the
// sheet keeps sliding at the finger's speed (sheet-motion.js). Phone layout
// and touch only: wider screens show a centered card, which closes by
// tapping outside it instead.

import { animateSheetClose, closeSheet } from './sheet-motion.js';

/** Tuning for the swipe. Adjust here. */
export const SWIPE = Object.freeze({
  closeFraction: 0.6, // drag this share of the sheet's height down and let go to close
  flickSpeed: 0.5, // px/ms; moving down at least this fast on release closes
  minFlickDistance: 30, // px; a flick must also have moved the sheet this far
  velocityWindowMs: 100, // release speed is measured over this last stretch of the drag
});
const START_SLOP = 8; // px before a move counts as a gesture
const SNAP_MS = 260;
const SNAP_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';
const PHONE_LAYOUT = '(max-width: 599px)';

// ---- Rules (pure) ----

/** How far the sheet moves for a finger movement: down only. */
export const dragOffset = (dy) => Math.max(0, dy);

/**
 * The finger's speed (px/ms, + is down) when it let go at `releasedAt`, from
 * the `samples` ({ y, t }) of the last `velocityWindowMs`. Zero when the
 * finger had stopped before letting go.
 */
export const releaseVelocity = (samples, releasedAt, windowMs = SWIPE.velocityWindowMs) => {
  const last = samples.at(-1);
  if (!last || releasedAt - last.t > windowMs) return 0;
  const recent = samples.filter((s) => last.t - s.t <= windowMs);
  const first = recent[0];
  const ms = last.t - first.t;
  return ms > 0 ? (last.y - first.y) / ms : 0;
};

/** Whether letting go after a drag of `dy` px, moving at `velocity`, should close the sheet. */
export const shouldClose = ({ dy, velocity, height }, swipe = SWIPE) => {
  if (velocity <= -swipe.flickSpeed) return false; // thrown back up
  if (dy >= height * swipe.closeFraction) return true;
  return dy >= swipe.minFlickDistance && velocity >= swipe.flickSpeed;
};

/** 'drag' to move the sheet, 'scroll' to leave the gesture alone, 'wait' if too small to tell. */
export const gestureIntent = ({ dx, dy, atTop, onHeader }) => {
  if (Math.abs(dx) < START_SLOP && Math.abs(dy) < START_SLOP) return 'wait';
  if (dy <= 0 || Math.abs(dx) > Math.abs(dy)) return 'scroll';
  return onHeader || atTop ? 'drag' : 'scroll';
};

// ---- Wiring (DOM) ----

const resetStyle = (dialog) => {
  dialog.style.transition = '';
  dialog.style.transform = '';
};

/** Follows the finger with no easing. */
const follow = (dialog, offset) => {
  dialog.style.transition = 'none';
  dialog.style.transform = `translateY(${offset}px)`;
};

/** Springs back to the open position, then hands motion back to the stylesheet. */
const snapBack = (dialog) => {
  dialog.style.transition = `transform ${SNAP_MS}ms ${SNAP_EASE}`;
  dialog.style.transform = '';
  setTimeout(() => { if (!dialog.style.transform) resetStyle(dialog); }, SNAP_MS);
};

/** Asks like Escape does: a listener may cancel the close (unsaved changes). */
export const requestClose = (dialog, { velocity = 0 } = {}) => {
  const event = new Event('cancel', { cancelable: true });
  dialog.dispatchEvent(event);
  if (event.defaultPrevented) snapBack(dialog);
  else closeSheet(dialog, { velocity });
};

/** Lets the user swipe `dialog` down to close it. */
export const enableSwipeToClose = (dialog) => {
  animateSheetClose(dialog, requestClose);
  let gesture = null;

  dialog.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1 || !window.matchMedia(PHONE_LAYOUT).matches) return;
    const touch = e.touches[0];
    gesture = {
      x: touch.clientX,
      y: touch.clientY,
      samples: [],
      onHeader: Boolean(e.target.closest('.sheet-top')),
      intent: 'wait',
    };
  }, { passive: true });

  dialog.addEventListener('touchmove', (e) => {
    if (!gesture || gesture.intent === 'scroll') return;
    const touch = e.touches[0];
    const dx = touch.clientX - gesture.x;
    const dy = touch.clientY - gesture.y;
    if (gesture.intent === 'wait') {
      gesture.intent = gestureIntent({ dx, dy, atTop: dialog.scrollTop <= 0, onHeader: gesture.onHeader });
      if (gesture.intent !== 'drag') return;
      gesture.y = touch.clientY; // start from here so the sheet doesn't jump by the slop
    }
    gesture.samples = [...gesture.samples, { y: touch.clientY, t: e.timeStamp }]
      .filter((s) => e.timeStamp - s.t <= SWIPE.velocityWindowMs * 2);
    e.preventDefault(); // keep the page from scrolling or bouncing while dragging
    follow(dialog, dragOffset(touch.clientY - gesture.y));
  }, { passive: false });

  const finish = (e, cancelled) => {
    const done = gesture;
    gesture = null;
    if (!done || done.intent !== 'drag') return;
    const dy = (e.changedTouches[0]?.clientY ?? done.y) - done.y;
    const velocity = releaseVelocity(done.samples, e.timeStamp);
    const close = !cancelled && shouldClose({ dy, velocity, height: dialog.offsetHeight });
    if (close) requestClose(dialog, { velocity });
    else snapBack(dialog);
  };

  dialog.addEventListener('touchend', (e) => finish(e, false));
  dialog.addEventListener('touchcancel', (e) => finish(e, true));
};
