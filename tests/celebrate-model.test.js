import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COLOR_KEYS } from '../src/course/color.js';
import { SHAPES, burstParticles } from '../src/celebrate-model.js';

// Small deterministic random source so the tests do not depend on Math.random.
const seeded = (seed) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

test('a burst has the requested number of particles', () => {
  assert.equal(burstParticles({ count: 22, color: 'teal', random: seeded(1) }).length, 22);
});

test('every particle uses a palette color and a known shape', () => {
  for (const p of burstParticles({ count: 60, color: 'teal', random: seeded(2) })) {
    assert.ok(COLOR_KEYS.includes(p.color), p.color);
    assert.ok(SHAPES.includes(p.shape), p.shape);
  }
});

test('the card color leads, with the rest of the palette mixed in', () => {
  const colors = burstParticles({ count: 200, color: 'pink', random: seeded(3) }).map((p) => p.color);
  const own = colors.filter((c) => c === 'pink').length / colors.length;
  assert.ok(own >= 0.35, `own color share ${own}`);
  assert.ok(new Set(colors).size >= 6, 'other palette colors appear too');
});

test('particles fan upward and stay within a tasteful range', () => {
  for (const p of burstParticles({ count: 80, color: 'violet', random: seeded(4) })) {
    assert.ok(p.angle >= -170 && p.angle <= -10, `angle ${p.angle}`);
    assert.ok(p.distance >= 40 && p.distance <= 150, `distance ${p.distance}`);
    assert.ok(p.size >= 5 && p.size <= 12, `size ${p.size}`);
    assert.ok(p.delay >= 0 && p.delay <= 80, `delay ${p.delay}`);
    assert.ok(p.duration >= 650 && p.duration <= 1100, `duration ${p.duration}`);
  }
});

test('a burst does not change between calls with the same random source', () => {
  assert.deepEqual(
    burstParticles({ count: 5, color: 'amber', random: seeded(9) }),
    burstParticles({ count: 5, color: 'amber', random: seeded(9) }),
  );
});

test('an unknown card color falls back to the whole palette', () => {
  const colors = burstParticles({ count: 30, color: 'plaid', random: seeded(5) }).map((p) => p.color);
  assert.ok(colors.every((c) => COLOR_KEYS.includes(c)));
});
