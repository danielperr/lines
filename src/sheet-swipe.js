// Swipe down to close a bottom sheet, as on iOS. A drag starts on the header
// (grabber and bar) at any time, or anywhere once the sheet is scrolled to the
// top. Closing goes through the dialog's `cancel` event, so the unsaved-changes
// guard still gets to ask; the close itself is the stylesheet's dialog
// transition. Phone layout and touch only: wider screens show a centered card
// without a grabber.

const CLOSE_DISTANCE = 140; // px; or a quarter of the sheet, if less
const MIN_FLICK_DISTANCE = 30; // px
const FLICK_SPEED = 0.5; // px per ms
const START_SLOP = 8; // px before a move counts as a gesture
const SNAP_MS = 200;
const PHONE_LAYOUT = '(max-width: 599px)';

// ---- Rules (pure) ----

/** How far the sheet moves for a finger movement: down only. */
export const dragOffset = (dy) => Math.max(0, dy);

/** Whether letting go after a drag of `dy` px over `ms` should close the sheet. */
export const shouldClose = ({ dy, ms, height }) => {
  if (dy >= Math.min(CLOSE_DISTANCE, height / 4)) return true;
  return dy >= MIN_FLICK_DISTANCE && dy / Math.max(ms, 1) >= FLICK_SPEED;
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
  dialog.style.transition = `transform ${SNAP_MS}ms ease-out`;
  dialog.style.transform = '';
  setTimeout(() => { if (!dialog.style.transform) resetStyle(dialog); }, SNAP_MS);
};

// Dropping the inline transform while closing lets the stylesheet's close
// transition carry the sheet down from where the finger let go.
const slideOutAndClose = (dialog) => {
  resetStyle(dialog);
  dialog.close();
};

/** Asks like Escape does: a listener may cancel the close (unsaved changes). */
const requestClose = (dialog) => {
  const event = new Event('cancel', { cancelable: true });
  dialog.dispatchEvent(event);
  if (event.defaultPrevented) snapBack(dialog);
  else slideOutAndClose(dialog);
};

/** Lets the user swipe `dialog` down to close it. */
export const enableSwipeToClose = (dialog) => {
  let gesture = null;

  dialog.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1 || !window.matchMedia(PHONE_LAYOUT).matches) return;
    const touch = e.touches[0];
    gesture = {
      x: touch.clientX,
      y: touch.clientY,
      startedAt: e.timeStamp,
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
      gesture.startedAt = e.timeStamp;
    }
    e.preventDefault(); // keep the page from scrolling or bouncing while dragging
    follow(dialog, dragOffset(touch.clientY - gesture.y));
  }, { passive: false });

  const finish = (e, cancelled) => {
    const done = gesture;
    gesture = null;
    if (!done || done.intent !== 'drag') return;
    const dy = (e.changedTouches[0]?.clientY ?? done.y) - done.y;
    const close = !cancelled && shouldClose({ dy, ms: e.timeStamp - done.startedAt, height: dialog.offsetHeight });
    if (close) requestClose(dialog);
    else snapBack(dialog);
  };

  dialog.addEventListener('touchend', (e) => finish(e, false));
  dialog.addEventListener('touchcancel', (e) => finish(e, true));
};
