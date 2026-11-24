import { planSchedule } from './scheduler.js';
import { DEFAULT_STATE, STORAGE_KEY, loadState, parseState, saveState, serializeState } from './storage.js';
import { h, localTodayIso } from './dom.js';
import { guardDialog } from './change-guard.js';
import { createCourseWizard } from './course-wizard-form.js';
import { createItemForm } from './item-form.js';
import { registerOffline } from './offline.js';
import { createTrackForm } from './track-form.js';
import { releasedBy } from './tracks.js';
import { hideWhileScrollingDown } from './scroll.js';
import { createUndo } from './undo.js';
import { renderApp } from './view.js';

const $ = (selector) => document.querySelector(selector);
const root = $('#app');
const settingsDialog = $('#settings-dialog');
const settingsForm = $('#settings-form');

let state = null;
let toastTimer = null;

const TOAST_MS = 3500;
const UNDO_MS = 6000;

const toastEl = $('#toast');
const toastText = $('#toast-text');
const toastAction = $('#toast-action');
let toastActionHandler = null;

const hideToast = () => {
  clearTimeout(toastTimer);
  toastEl.hidden = true;
  toastActionHandler = null;
};

const showToast = (message, onAction = null) => {
  clearTimeout(toastTimer);
  toastText.textContent = message;
  toastAction.hidden = !onAction;
  toastActionHandler = onAction;
  toastEl.hidden = false;
  if (!onAction) toastTimer = setTimeout(hideToast, TOAST_MS);
};

toastAction.addEventListener('click', () => toastActionHandler?.());

const undo = createUndo({ show: showToast, hide: hideToast, timeoutMs: UNDO_MS });

/** A plain message; it replaces (and cancels) any pending Undo. */
const toast = (message) => {
  undo.dismiss();
  showToast(message);
};

const render = () => {
  const plan = planSchedule(state.items, state.weeklyHours, localTodayIso(), state.tracks);
  renderApp(root, { plan, weeklyHours: state.weeklyHours, actions });
};

const commit = (nextState) => {
  state = nextState;
  const saved = saveState(state);
  if (!saved.ok) toast(saved.error);
  render();
};

/** Applies a change and offers to put the previous state back. */
const commitUndoable = (nextState, message) => {
  const previous = state;
  commit(nextState);
  undo.offer(message, () => {
    commit(previous);
    showToast('Undone.');
  });
};

// ---- Item dialog ----

const saveItem = (item) => {
  const exists = state.items.some((existing) => existing.id === item.id);
  commit({ ...state, items: exists ? state.items.map((i) => (i.id === item.id ? item : i)) : [...state.items, item] });
  toast(`Saved "${item.title}"`);
};

const deleteItem = (id) => {
  const item = state.items.find((i) => i.id === id);
  commitUndoable({ ...state, items: state.items.filter((i) => i.id !== id) }, `Deleted "${item?.title ?? 'deadline'}"`);
};

const itemForm = createItemForm({
  dialog: $('#item-dialog'), onSave: saveItem, onDelete: deleteItem, getTracks: () => state.tracks,
});

// ---- Lecture track dialog ----

const replaceOrAppend = (list, entry) => (list.some((x) => x.id === entry.id)
  ? list.map((x) => (x.id === entry.id ? entry : x))
  : [...list, entry]);

const saveTrack = (track) => {
  commit({ ...state, tracks: replaceOrAppend(state.tracks, track) });
  toast(`Saved "${track.name}"`);
};

/** Returns an error message instead of deleting when deadlines still link to the track. */
const deleteTrack = (id) => {
  const linked = state.items.filter((item) => item.parts.some((p) => p.trackId === id)).map((item) => item.title);
  if (linked.length) return `Remove it from ${linked.join(', ')} first.`;
  const track = state.tracks.find((t) => t.id === id);
  commitUndoable({ ...state, tracks: state.tracks.filter((t) => t.id !== id) }, `Deleted "${track?.name ?? 'track'}"`);
  return null;
};

const trackForm = createTrackForm({ dialog: $('#track-dialog'), onSave: saveTrack, onDelete: deleteTrack });

// ---- Add-course wizard ----

/** Adds a lecture track (if any) and its deadlines in one step, with Undo. */
const addCourse = ({ track, items }) => {
  const name = track?.name ?? items[0]?.course ?? 'course';
  commitUndoable({
    ...state,
    tracks: track ? [...state.tracks, track] : state.tracks,
    items: [...state.items, ...items],
  }, `Added "${name}"`);
};

const courseNames = () => [...state.tracks.map((t) => t.name), ...state.items.map((i) => i.course)].filter(Boolean);

const courseWizard = createCourseWizard({ dialog: $('#course-dialog'), onSave: addCourse, getCourseNames: courseNames });

// ---- Settings dialog ----

const openSettings = () => {
  settingsForm.reset();
  $('#settings-errors').textContent = '';
  settingsForm.elements.weeklyHours.value = state.weeklyHours;
  settingsDialog.showModal();
};

settingsForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const weeklyHours = Number(settingsForm.elements.weeklyHours.value);
  if (!Number.isFinite(weeklyHours) || weeklyHours <= 0 || weeklyHours > 168) {
    $('#settings-errors').textContent = 'Enter between 1 and 168 hours.';
    return;
  }
  commit({ ...state, weeklyHours });
  settingsDialog.close();
  toast(`Saved · ${weeklyHours}h per week`);
});

$('#export-btn').addEventListener('click', () => {
  const blob = new Blob([serializeState(state)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = h('a', { href: url, download: `deadlines-${localTodayIso()}.json` });
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
});

$('#import-input').addEventListener('change', async (e) => {
  const [file] = e.target.files;
  e.target.value = '';
  if (!file) return;
  try {
    const result = parseState(await file.text());
    if (!result.ok) {
      $('#settings-errors').textContent = `Import failed: ${result.error}`;
      return;
    }
    if (!window.confirm(`Replace your current data with ${result.state.items.length} deadlines and ${result.state.tracks.length} lecture tracks?`)) return;
    commit(result.state);
    settingsDialog.close();
    toast('Import complete.');
  } catch (error) {
    $('#settings-errors').textContent = `Could not read the file: ${error.message}`;
  }
});

// ---- Wiring ----

const stepPart = (part, delta) => ({
  ...part,
  doneUnits: Math.min(part.totalUnits, Math.max(0, part.doneUnits + delta)),
});

/** +1 / −1 on a deadline's effort part, with Undo. */
const step = (itemId, partId, delta) => {
  const item = state.items.find((i) => i.id === itemId);
  const part = item?.parts.find((p) => p.id === partId);
  if (!part) return;
  const next = stepPart(part, delta);
  if (next.doneUnits === part.doneUnits) return;
  const items = state.items.map((i) => (i.id !== itemId ? i : { ...i, parts: i.parts.map((p) => (p.id === partId ? next : p)) }));
  commitUndoable({ ...state, items }, `${item.title}: ${next.doneUnits}/${next.totalUnits} ${next.unit}`);
};

/** +1 / −1 watched lecture, with Undo. Oldest first; can't watch one that isn't out yet. */
const watch = (trackId, delta) => {
  const track = state.tracks.find((t) => t.id === trackId);
  if (!track) return;
  const released = releasedBy(track, localTodayIso());
  const watched = Math.min(released, Math.max(0, track.watched + delta));
  if (watched === track.watched) return;
  const tracks = state.tracks.map((t) => (t.id === trackId ? { ...t, watched } : t));
  commitUndoable({ ...state, tracks }, `${track.name}: ${watched}/${released} watched`);
};

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Scrolls to the first card of a course (opening Completed if needed) and highlights it. */
const jumpToCourse = (key) => {
  const card = root.querySelector(`[data-course="${CSS.escape(key)}"]`);
  if (!card) return;
  const details = card.closest('details');
  if (details) details.open = true;
  card.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  card.classList.remove('flash');
  void card.offsetWidth; // restart the animation on repeated taps
  card.classList.add('flash');
};

const markItemClean = guardDialog($('#item-dialog'));
const markTrackClean = guardDialog($('#track-dialog'));
const markSettingsClean = guardDialog(settingsDialog);
const markCourseClean = guardDialog($('#course-dialog'));

const actions = {
  step,
  watch,
  jump: jumpToCourse,
  edit: (id) => { itemForm.open(state.items.find((item) => item.id === id)); markItemClean(); },
  editTrack: (id) => { trackForm.open(state.tracks.find((t) => t.id === id)); markTrackClean(); },
  settings: () => { openSettings(); markSettingsClean(); },
  addCourse: () => { courseWizard.open(); markCourseClean(); },
};

$('#add-btn').addEventListener('click', () => actions.edit(null));
hideWhileScrollingDown($('#add-btn'), 'fab-hidden');

// iOS Safari only applies :active (pressed styles) when a touch listener exists.
document.addEventListener('touchstart', () => {}, { passive: true });

// Re-render when the app comes back into view, so "today" stays current.
document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });

const init = () => {
  const loaded = loadState();
  if (loaded.ok) {
    state = loaded.state;
  } else {
    const backupKey = `${STORAGE_KEY}:unreadable-${Date.now()}`;
    localStorage.setItem(backupKey, localStorage.getItem(STORAGE_KEY));
    state = { ...DEFAULT_STATE, items: [], tracks: [] };
    toast(`Saved data could not be loaded (${loaded.error}). A copy was kept as "${backupKey}".`);
  }
  render();
};

init();
registerOffline();
