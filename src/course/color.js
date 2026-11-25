// Course colors. A course stores a palette key ('violet', ...), never a hex
// value; the hex values here are the source for the [data-color] blocks in
// styles.css. A course without a valid key gets one from its list position.
//
// Roles per mode: `solid` card fill, `on` text on solid, `tint` light fill,
// `ink` text on tint. Every text pair must reach 4.5:1 (tested).

const freezeColor = (light, dark) => Object.freeze({ light: Object.freeze(light), dark: Object.freeze(dark) });

export const PALETTE = Object.freeze({
  violet: freezeColor(
    { solid: '#6c4ce0', on: '#ffffff', tint: '#ece7fd', ink: '#3b2a8c' },
    { solid: '#7457e4', on: '#ffffff', tint: '#2a2347', ink: '#cfc3ff' },
  ),
  amber: freezeColor(
    { solid: '#ffb547', on: '#3d2600', tint: '#fff1d9', ink: '#6b4300' },
    { solid: '#f5a524', on: '#2e1c00', tint: '#3a2c12', ink: '#ffd38a' },
  ),
  teal: freezeColor(
    { solid: '#2ec4a6', on: '#00352b', tint: '#daf5ef', ink: '#0b5c4c' },
    { solid: '#26b597', on: '#00241d', tint: '#143630', ink: '#8ae8d4' },
  ),
  coral: freezeColor(
    { solid: '#c9402b', on: '#ffffff', tint: '#fde6e1', ink: '#8a2414' },
    { solid: '#e0614b', on: '#1f0500', tint: '#3d1d17', ink: '#ffb4a6' },
  ),
  blue: freezeColor(
    { solid: '#2563d9', on: '#ffffff', tint: '#e1ebfc', ink: '#173f8f' },
    { solid: '#4a84f0', on: '#00102e', tint: '#18284a', ink: '#a9c6ff' },
  ),
  pink: freezeColor(
    { solid: '#c2317a', on: '#ffffff', tint: '#fbe3ef', ink: '#80174d' },
    { solid: '#e0559a', on: '#1f0010', tint: '#3d1a2c', ink: '#ffb0d6' },
  ),
  green: freezeColor(
    { solid: '#7bc96f', on: '#13380d', tint: '#e6f5e2', ink: '#2c5f22' },
    { solid: '#6bba5f', on: '#0c2607', tint: '#1c3418', ink: '#b2e8a8' },
  ),
  slate: freezeColor(
    { solid: '#4a5568', on: '#ffffff', tint: '#e8ebf0', ink: '#2d3646' },
    { solid: '#8a96aa', on: '#10151d', tint: '#262c36', ink: '#c9d2e0' },
  ),
});

export const COLOR_KEYS = Object.freeze(Object.keys(PALETTE));

export const isColorKey = (value) => typeof value === 'string' && Object.hasOwn(PALETTE, value);

/** "Violet" for 'violet': the swatch's accessible name. */
export const colorLabel = (key) => key.charAt(0).toUpperCase() + key.slice(1);

/** The course's color key: its stored one, or a fallback from its position. */
export const courseColor = (course, index) =>
  (isColorKey(course.color) ? course.color : COLOR_KEYS[index % COLOR_KEYS.length]);

/** The least-used color among `courses`, earliest in the palette on ties. */
export const nextColor = (courses) => {
  const used = courses.map(courseColor);
  const uses = (key) => used.filter((k) => k === key).length;
  return COLOR_KEYS.reduce((best, key) => (uses(key) < uses(best) ? key : best));
};

/** A copy of `course` that has a valid color, picked against `others` if needed. */
export const assignColor = (course, others) =>
  ({ ...course, color: isColorKey(course.color) ? course.color : nextColor(others) });

/** Map of course id → color key, resolved in stored order (not display order). */
export const colorsById = (courses) => new Map(courses.map((course, index) => [course.id, courseColor(course, index)]));
