// Asks before a dialog closes with unsaved edits. The form's values are
// fingerprinted when it opens; closing compares against that snapshot.

export const createChangeGuard = ({ read, confirm }) => {
  let clean = null;
  return {
    markClean: () => { clean = read(); },
    mayClose: () => read() === clean || confirm(),
  };
};

/** Every field value in the form, in order, as one comparable string. */
export const formFingerprint = (form) => JSON.stringify(
  [...form.querySelectorAll('input, select, textarea')]
    .filter((el) => el.type !== 'file')
    .map((el) => (el.type === 'checkbox' || el.type === 'radio' ? el.checked : el.value)),
);

/**
 * Wires a dialog so Cancel, Escape and the Android back gesture ask before
 * discarding edits. Returns markClean(), to call right after the dialog opens.
 */
export const guardDialog = (dialog) => {
  const form = dialog.querySelector('form');
  const guard = createChangeGuard({
    read: () => formFingerprint(form),
    confirm: () => window.confirm('Discard your changes?'),
  });
  dialog.querySelectorAll('[data-close]').forEach((btn) => btn.addEventListener('click', () => {
    if (guard.mayClose()) dialog.close();
  }));
  dialog.addEventListener('cancel', (e) => {
    if (!guard.mayClose()) e.preventDefault();
  });
  return guard.markClean;
};
