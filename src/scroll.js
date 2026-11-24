// Hides the floating + button while scrolling down so it doesn't cover cards.

const SCROLL_JITTER_PX = 8;

/** 'down', 'up', or null for movements too small to count. */
export const scrollDirection = (previousY, y) => {
  if (y <= 0 && previousY > 0) return 'up';
  if (Math.abs(y - previousY) < SCROLL_JITTER_PX) return null;
  return y > previousY ? 'down' : 'up';
};

export const hideWhileScrollingDown = (el, hiddenClass) => {
  let lastY = window.scrollY;
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    const direction = scrollDirection(lastY, y);
    if (!direction) return;
    el.classList.toggle(hiddenClass, direction === 'down');
    lastY = y;
  }, { passive: true });
};
