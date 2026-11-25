// Password managers (Dashlane in particular) must leave the app's fields alone:
// none of them hold credentials, and Dashlane's autofill was closing the tab
// when the wizard focused a new exam row.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NOT_CREDENTIALS, withFieldDefaults } from '../src/dom.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('fields are marked as not credentials for Dashlane', () => {
  assert.deepEqual(NOT_CREDENTIALS, { 'data-form-type': 'other' });
});

test('every form and field in index.html opts out of autofill', () => {
  const tags = html.match(/<(form|input|select|textarea)\b[^>]*>/g);
  const missing = tags.filter((tag) => !tag.includes('data-form-type="other"'));
  assert.ok(tags.length > 0);
  assert.deepEqual(missing, []);
});

test('fields built in code get the opt-out added', () => {
  for (const tag of ['input', 'select', 'textarea']) {
    assert.deepEqual(withFieldDefaults(tag, { name: 'title' }), { 'data-form-type': 'other', name: 'title' });
  }
});

test('other elements are left as they are', () => {
  const props = { class: 'x' };
  assert.equal(withFieldDefaults('button', props), props);
});

test('adding the opt-out never changes the props passed in', () => {
  const props = { name: 'due' };
  withFieldDefaults('input', props);
  assert.deepEqual(props, { name: 'due' });
});
