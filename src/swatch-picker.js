// Course color picker: one native radio per palette color, so arrow keys,
// Tab and screen readers work as they do for any radio group. Picking a color
// previews it on the whole sheet through the dialog's data-color.

import { h } from './dom.js';
import { COLOR_KEYS, colorLabel, isColorKey } from './course/color.js';

const swatch = (name, key) => h('label', { class: 'swatch', dataset: { color: key } },
  h('input', { type: 'radio', name, value: key, 'aria-label': colorLabel(key) }),
  h('span', { class: 'swatch-dot', 'aria-hidden': 'true' }));

/**
 * Fills `container` with the swatches and returns get/set for the picked key.
 * Changes are previewed on `dialog`.
 */
export const createSwatchPicker = ({ container, dialog, name = 'color' }) => {
  container.replaceChildren(...COLOR_KEYS.map((key) => swatch(name, key)));
  const radios = () => [...container.querySelectorAll(`input[name="${name}"]`)];

  const get = () => radios().find((el) => el.checked)?.value ?? null;
  const set = (key) => {
    radios().forEach((el) => { el.checked = el.value === key; });
    if (isColorKey(key)) dialog.dataset.color = key;
  };

  container.addEventListener('change', () => {
    const key = get();
    if (isColorKey(key)) dialog.dataset.color = key;
  });

  return { get, set };
};
