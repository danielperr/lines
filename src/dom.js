// Tiny DOM helpers. Text always goes through textContent, so user data can never inject HTML.

/**
 * Tells password managers a field holds no credentials. Dashlane reads
 * data-form-type (https://dashlane.github.io/SAWF/); without it, its autofill
 * reacted to newly focused fields and could close the tab.
 */
export const NOT_CREDENTIALS = Object.freeze({ 'data-form-type': 'other' });

const FIELD_TAGS = new Set(['input', 'select', 'textarea']);

/** Props for a new element; form fields also get NOT_CREDENTIALS (props win). */
export const withFieldDefaults = (tag, props) => (FIELD_TAGS.has(tag) ? { ...NOT_CREDENTIALS, ...props } : props);

export const h = (tag, props = {}, ...children) => {
  const el = document.createElement(tag);
  Object.entries(withFieldDefaults(tag, props)).forEach(([key, value]) => {
    if (value === undefined || value === null || value === false) return;
    if (key === 'class') el.className = value;
    else if (key === 'style') el.style.cssText = value;
    else if (key.startsWith('on')) el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else el.setAttribute(key, value === true ? '' : String(value));
  });
  children.flat().forEach((child) => {
    if (child === null || child === undefined || child === false) return;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  });
  return el;
};

export const localTodayIso = (now = new Date()) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

const dateFormat = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

export const formatDate = (iso) => dateFormat.format(new Date(`${iso}T00:00:00Z`));

const shortDateFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });

export const formatShortDate = (iso) => shortDateFormat.format(new Date(`${iso}T00:00:00Z`));

export const formatHours = (hours) => {
  const rounded = Math.round(hours * 10) / 10;
  return `${rounded}h`;
};

export const formatRelativeDays = (days) => {
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  return days > 0 ? `in ${days}d` : `${-days}d ago`;
};

export const newId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
