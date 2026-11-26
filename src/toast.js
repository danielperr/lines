// The bottom toast: a message, optionally with one action button (Undo).
//
// An open modal sheet makes everything outside it inert, so the toast lives
// inside the topmost open sheet (and goes back to <body> when that sheet
// closes) to keep its button tappable.

const MESSAGE_MS = 3500;

/** Returns { show(message, onAction?), hide() } for the toast element `el`. */
export const createToast = (el) => {
  const textEl = el.querySelector('#toast-text');
  const actionEl = el.querySelector('#toast-action');
  let timer = null;
  let onActionHandler = null;

  const place = () => {
    const host = [...document.querySelectorAll('dialog[open]:not(.is-closing)')].at(-1) ?? document.body;
    if (el.parentElement !== host) host.append(el);
  };

  const hide = () => {
    clearTimeout(timer);
    el.hidden = true;
    onActionHandler = null;
  };

  /** Without an action the toast hides itself; with one it stays until hide(). */
  const show = (message, onAction = null) => {
    clearTimeout(timer);
    textEl.textContent = message;
    actionEl.hidden = !onAction;
    onActionHandler = onAction;
    place();
    el.hidden = false;
    if (!onAction) timer = setTimeout(hide, MESSAGE_MS);
  };

  actionEl.addEventListener('click', () => onActionHandler?.());
  // `close` does not bubble, so listen in the capture phase.
  document.addEventListener('close', (e) => {
    if (e.target.contains(el)) document.body.append(el);
  }, true);

  return { show, hide };
};
