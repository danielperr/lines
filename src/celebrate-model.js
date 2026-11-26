// The recipe for a +1 confetti burst. Pure: the random source is passed in,
// so a burst can be reproduced in tests. celebrate.js draws it.

import { COLOR_KEYS, isColorKey } from './course/color.js';

export const SHAPES = Object.freeze(['dot', 'streamer', 'star']);

const OWN_COLOR_SHARE = 0.45;
const FAN_DEGREES = 160; // centered on straight up (-90°)

const between = (random, min, max) => min + random() * (max - min);
const pick = (random, list) => list[Math.floor(random() * list.length) % list.length];

const particle = (random, color) => ({
  color: isColorKey(color) && random() < OWN_COLOR_SHARE ? color : pick(random, COLOR_KEYS),
  shape: pick(random, SHAPES),
  angle: Math.round(-90 + (random() - 0.5) * FAN_DEGREES),
  distance: Math.round(between(random, 40, 150)),
  size: Math.round(between(random, 5, 12)),
  spin: Math.round(between(random, -540, 540)),
  delay: Math.round(between(random, 0, 80)),
  duration: Math.round(between(random, 650, 1100)),
});

/** `count` particles leaning on the card's `color`, from `random()` in [0, 1). */
export const burstParticles = ({ count, color, random = Math.random }) =>
  Array.from({ length: count }, () => particle(random, color));
