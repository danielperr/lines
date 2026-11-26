// Close motion for sheets. The browser's own close drops a dialog out of the
// top layer at once, and the CSS exit transition that would cover it needs
// `transition: overlay`, which Safari lacks. So a close first slides the
// sheet out while it is still open (the `is-closing` class in motion.css),
// then closes it for real. Every close goes through here: `dialog.close()`
// is wrapped per sheet, and Escape is routed through the cancel event so the
// unsaved-changes guard still gets to ask.

export const CLOSE_MS = 420; // matches the transition in motion.css
const MIN_FLING_MS = 160;
const CLOSING = 'is-closing';

// ---- Rules (pure) ----

/**
 * How long the slide out should take. A flick carries on at the finger's
 * speed (never slower than the default); otherwise the default length.
 */
export const closeDuration = ({ distance, velocity }) => {
  if (!(velocity > 0) || !(distance > 0)) return CLOSE_MS;
  // The ease starts at about twice its average speed, so match that to the finger.
  const ms = (2 * distance) / velocity;
  return Math.round(Math.min(CLOSE_MS, Math.max(MIN_FLING_MS, ms)));
};

// ---- Wiring (DOM) ----

const nativeClose = globalThis.HTMLDialogElement?.prototype.close; // absent under node tests
const pending = new WeakMap(); // dialog → { timer, onEnd }

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Whether `dialog` is sliding out. */
export const isClosing = (dialog) => pending.has(dialog);

const clearPending = (dialog) => {
  const run = pending.get(dialog);
  if (!run) return;
  clearTimeout(run.timer);
  dialog.removeEventListener('transitionend', run.onEnd);
  pending.delete(dialog);
};

/** Closes at once, with no exit transition left to show in the page. */
const finishClose = (dialog, returnValue) => {
  clearPending(dialog);
  dialog.style.transition = 'none';
  nativeClose.call(dialog, returnValue);
  dialog.classList.remove(CLOSING);
  void dialog.offsetHeight; // commit the closed state before transitions come back
  dialog.style.transition = '';
  dialog.style.transform = '';
};

/**
 * Slides `dialog` out, then closes it. `velocity` (px/ms, downward) is the
 * finger's speed when a swipe let go, so the sheet keeps its momentum.
 */
export const closeSheet = (dialog, { velocity = 0, returnValue } = {}) => {
  if (!dialog.open || isClosing(dialog)) return;
  if (prefersReducedMotion()) {
    finishClose(dialog, returnValue);
    return;
  }
  const from = dialog.getBoundingClientRect();
  const distance = Math.max(0, window.innerHeight - from.top);
  const ms = closeDuration({ distance, velocity });

  // Drop any drag offset so the stylesheet carries the sheet on from where it is.
  dialog.style.transition = '';
  dialog.style.transitionDuration = `${ms}ms`;
  dialog.style.transform = '';
  dialog.classList.add(CLOSING);

  const onEnd = (e) => { if (e.target === dialog && e.propertyName === 'transform') finishClose(dialog, returnValue); };
  dialog.addEventListener('transitionend', onEnd);
  const timer = setTimeout(() => finishClose(dialog, returnValue), ms + 80); // in case transitionend never comes
  pending.set(dialog, { timer, onEnd });
};

/** Stops a close in progress and brings the sheet back. */
const cancelClose = (dialog) => {
  if (!isClosing(dialog)) return;
  clearPending(dialog);
  dialog.classList.remove(CLOSING);
  dialog.style.transitionDuration = '';
};

/**
 * Makes every close of `dialog` animate: `close()` calls and Escape.
 * `requestClose` asks the dialog's cancel listeners first (see sheet-swipe.js).
 */
export const animateSheetClose = (dialog, requestClose) => {
  dialog.close = (returnValue) => closeSheet(dialog, { returnValue });
  const nativeShowModal = dialog.showModal.bind(dialog);
  dialog.showModal = () => {
    if (isClosing(dialog)) cancelClose(dialog);
    else nativeShowModal();
  };
  dialog.addEventListener('transitionend', (e) => {
    if (e.target === dialog && !isClosing(dialog)) dialog.style.transitionDuration = '';
  });
  // Escape: take over the browser's close so it can animate. Capture listeners
  // on the target run first, so the guard only hears the re-sent request.
  dialog.addEventListener('cancel', (e) => {
    if (!e.isTrusted) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    requestClose(dialog);
  }, true);
};
