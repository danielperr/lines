// One pending "Undo" at a time, shown in the toast until it expires or is replaced.

/**
 * show(message, onUndo) displays the toast with an Undo button; hide() removes it.
 * offer(message, restore) replaces any earlier offer; restore runs at most once.
 */
export const createUndo = ({ show, hide, timeoutMs }) => {
  let pending = null;

  const clear = () => {
    if (pending) clearTimeout(pending.timer);
    pending = null;
  };

  const offer = (message, restore) => {
    clear();
    const entry = { restore, timer: null };
    entry.timer = setTimeout(() => {
      if (pending === entry) {
        pending = null;
        hide();
      }
    }, timeoutMs);
    pending = entry;
    show(message, () => {
      if (pending !== entry) return;
      clear();
      hide();
      entry.restore();
    });
  };

  return { offer, dismiss: clear };
};
