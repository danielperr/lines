// Page change inside a sheet: the old page fades away while the sheet eases to
// the new page's height, then the new page fades in. The old page is a
// throwaway copy laid over its old spot, so the real DOM switches at once
// (focus, validation and screen readers see the new page immediately).

const FADE_OUT_MS = 160;
const FADE_IN_MS = 260;
const HEIGHT_MS = 380;
const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';
const FIELDS = 'input, select, textarea';

const running = new WeakMap(); // sheet → animations in flight

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** cloneNode copies attributes only; typed values and checks are copied by hand. */
const copyFieldState = (from, to) => {
  const targets = [...to.querySelectorAll(FIELDS)];
  [...from.querySelectorAll(FIELDS)].forEach((field, i) => {
    if (!targets[i]) return;
    targets[i].value = field.value;
    targets[i].checked = field.checked;
  });
};

/** A non-interactive copy of `page`, pinned over it inside `sheet`. */
const ghostOf = (page, sheet) => {
  const ghost = page.cloneNode(true);
  copyFieldState(page, ghost);
  [ghost, ...ghost.querySelectorAll('[id], [name]')].forEach((el) => {
    el.removeAttribute('id');
    el.removeAttribute('name');
  });
  ghost.removeAttribute('data-step');
  ghost.inert = true;
  ghost.setAttribute('aria-hidden', 'true');
  const box = page.getBoundingClientRect();
  const frame = sheet.getBoundingClientRect();
  Object.assign(ghost.style, {
    position: 'absolute',
    top: `${box.top - frame.top + sheet.scrollTop}px`,
    left: `${box.left - frame.left}px`,
    width: `${box.width}px`,
    margin: '0',
    pointerEvents: 'none',
  });
  return ghost;
};

const finishRunning = (sheet) => {
  (running.get(sheet) ?? []).forEach((animation) => animation.finish());
  running.delete(sheet);
};

/**
 * Runs `swap()` (which hides `fromPage` and shows the next page) with motion.
 * `getToPage()` returns the page shown after the swap.
 */
export const animatePageChange = ({ sheet, fromPage, swap, getToPage }) => {
  finishRunning(sheet);
  if (!fromPage || prefersReducedMotion() || typeof sheet.animate !== 'function') {
    swap();
    return;
  }
  const startHeight = sheet.getBoundingClientRect().height;
  const ghost = ghostOf(fromPage, sheet);
  sheet.append(ghost);
  swap();
  const endHeight = sheet.getBoundingClientRect().height;
  const toPage = getToPage();

  sheet.style.overflow = 'hidden';
  const animations = [
    sheet.animate([{ height: `${startHeight}px` }, { height: `${endHeight}px` }], { duration: HEIGHT_MS, easing: EASE }),
    ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE_OUT_MS, easing: 'ease-out', fill: 'forwards' }),
    toPage.animate(
      [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }],
      { duration: FADE_IN_MS, delay: FADE_OUT_MS * 0.75, easing: EASE, fill: 'backwards' },
    ),
  ];
  running.set(sheet, animations);
  Promise.all(animations.map((a) => a.finished.catch(() => {}))).then(() => {
    ghost.remove();
    if (running.has(sheet) && running.get(sheet) !== animations) return; // a newer change owns the sheet now
    sheet.style.overflow = '';
    running.delete(sheet);
  });
};
