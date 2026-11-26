// The +1 celebration on a Today card: confetti from the button, a ring pulse,
// a floating "+1" chip, and a sheen with a small pop on the card. A +1 redraws
// the home screen, so everything is drawn on a fixed layer from positions taken
// before the redraw. Purely decorative: aria-hidden and pointer-events: none.

import { h } from './dom.js';
import { burstParticles } from './celebrate-model.js';

const PARTICLES = 22;
const PARTICLES_WHEN_CLEARED = 40; // the tap that finishes the course for today
const FALL_PX = 70;
const LAYER_LIFETIME_MS = 1400;
const RISE = 'cubic-bezier(0.15, 0.7, 0.3, 1)'; // shoots out, slows at the top
const FALL = 'cubic-bezier(0.5, 0, 0.9, 0.6)'; // speeds up as it drops

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Positions to celebrate from, read before the +1 redraws the screen. */
export const celebrationSpot = (button) => {
  const card = button.closest('.today-card');
  return {
    button: button.getBoundingClientRect(),
    courseId: card?.dataset.courseId ?? null,
    color: card?.dataset.color ?? null,
  };
};

const center = (rect) => ({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });

const confetti = (p, origin) => {
  const piece = h('span', { class: `confetti confetti-${p.shape}`, dataset: { color: p.color } });
  piece.style.cssText = `left:${origin.x}px;top:${origin.y}px;--size:${p.size}px`;
  const rad = (p.angle * Math.PI) / 180;
  const dx = Math.cos(rad) * p.distance;
  const dy = Math.sin(rad) * p.distance;
  const at = (x, y, scale, turn) => `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${scale}) rotate(${turn}deg)`;
  piece.animate([
    { transform: at(0, 0, 0.3, 0), opacity: 1, easing: RISE },
    { transform: at(dx, dy, 1, p.spin * 0.6), opacity: 1, offset: 0.5, easing: FALL },
    { transform: at(dx * 1.15, dy + FALL_PX, 0.7, p.spin), opacity: 0 },
  ], { duration: p.duration, delay: p.delay, fill: 'both' });
  return piece;
};

const ring = (origin, color, size, scale) => {
  const el = h('span', { class: 'celebration-ring', dataset: { color } });
  el.style.cssText = `left:${origin.x}px;top:${origin.y}px;width:${size}px;height:${size}px`;
  el.animate([
    { transform: 'translate(-50%, -50%) scale(0.6)', opacity: 0.9 },
    { transform: `translate(-50%, -50%) scale(${scale})`, opacity: 0 },
  ], { duration: 650, easing: RISE, fill: 'both' });
  return el;
};

const chip = (origin, color, text, still) => {
  const el = h('span', { class: 'celebration-chip', dataset: { color } }, text);
  el.style.cssText = `left:${origin.x}px;top:${origin.y}px`;
  const lift = still ? 0 : -46;
  el.animate([
    { transform: 'translate(-50%, -50%) translateY(0) scale(0.6)', opacity: 0 },
    { transform: `translate(-50%, -50%) translateY(${lift * 0.6}px) scale(1.08)`, opacity: 1, offset: 0.3 },
    { transform: `translate(-50%, -50%) translateY(${lift}px) scale(1)`, opacity: 0 },
  ], { duration: 950, easing: RISE, fill: 'both' });
  return el;
};

/** A light band across the card, plus a small pop. */
const shineCard = (card) => {
  const box = card.getBoundingClientRect();
  const sheen = h('span', { class: 'celebration-sheen' }, h('span', {}));
  sheen.style.cssText = `left:${box.left}px;top:${box.top}px;width:${box.width}px;height:${box.height}px;border-radius:${getComputedStyle(card).borderRadius}`;
  sheen.firstChild.animate(
    [{ transform: 'translateX(-120%) skewX(-18deg)' }, { transform: 'translateX(220%) skewX(-18deg)' }],
    { duration: 800, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'both' },
  );
  card.animate(
    [{ transform: 'scale(1)' }, { transform: 'scale(1.02)', offset: 0.35 }, { transform: 'scale(1)' }],
    { duration: 480, easing: 'ease-out' },
  );
  return sheen;
};

const EDGE_PX = 8;

/** Nudges a centered element sideways so it stays inside the window. */
const keepInView = (el, x) => {
  const half = el.offsetWidth / 2;
  const clamped = Math.min(Math.max(x, half + EDGE_PX), window.innerWidth - half - EDGE_PX);
  el.style.left = `${clamped}px`;
};

const findCard = (courseId) => (courseId
  ? document.querySelector(`.today-card[data-course-id="${CSS.escape(courseId)}"]`)
  : null);

/** Plays the celebration for a +1 tapped at `spot` (see celebrationSpot), after the redraw. */
export const celebrate = (spot) => {
  if (typeof document.body.animate !== 'function') return;
  const origin = center(spot.button);
  const card = findCard(spot.courseId);
  const cleared = spot.courseId !== null && !card;
  const still = prefersReducedMotion();
  const layer = h('div', { class: 'celebration', 'aria-hidden': 'true' });

  const label = chip(origin, spot.color, cleared ? 'Done for today' : '+1', still);
  if (still) {
    layer.append(label);
  } else {
    const count = cleared ? PARTICLES_WHEN_CLEARED : PARTICLES;
    const size = Math.max(spot.button.width, spot.button.height);
    layer.append(
      ring(origin, spot.color, size, cleared ? 4 : 2.6),
      ...burstParticles({ count, color: spot.color }).map((p) => confetti(p, origin)),
      label,
    );
    if (card) layer.append(shineCard(card));
  }
  document.body.append(layer);
  keepInView(label, origin.x);
  setTimeout(() => layer.remove(), LAYER_LIFETIME_MS);
};
