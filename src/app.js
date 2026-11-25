import { planCourses } from './course/planner.js';
import { releasedBy } from './course/schedule.js';
import {
  DEFAULT_STATE, LEGACY_STORAGE_KEY, STORAGE_KEY, loadState, parseState, saveState, serializeState,
} from './course/store.js';
import { h, localTodayIso } from './dom.js';
import { guardDialog } from './change-guard.js';
import { createCourseWizard } from './course-wizard-form.js';
import { renderHome } from './home-view.js';
import { registerOffline } from './offline.js';
import { hideWhileScrollingDown } from './scroll.js';
import { createUndo } from './undo.js';

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
  const plan = planCourses(state, localTodayIso());
  renderHome(root, { plan, weeklyHours: state.weeklyHours, actions });
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

const findCourse = (id) => state.courses.find((c) => c.id === id);

const withCourse = (course) => ({ ...state, courses: state.courses.map((c) => (c.id === course.id ? course : c)) });

// ---- Add-course wizard ----

const addCourse = (course) => {
  commitUndoable({ ...state, courses: [...state.courses, course] }, `Added "${course.name}"`);
};

const courseWizard = createCourseWizard({
  dialog: $('#course-dialog'), onSave: addCourse, getCourseNames: () => state.courses.map((c) => c.name),
});

// ---- Progress ----

/** +1 / −1 watched lecture, with Undo. Oldest first; can't watch one that isn't out yet. */
const watch = (courseId, delta) => {
  const course = findCourse(courseId);
  if (!course?.schedule) return;
  const released = releasedBy(course.schedule, localTodayIso());
  const watched = Math.min(released, Math.max(0, course.watched + delta));
  if (watched === course.watched) return;
  commitUndoable(withCourse({ ...course, watched }), `${course.name}: ${watched}/${released} watched`);
};

/** +1 / −1 unit of prep on a milestone, with Undo. */
const stepPrep = (courseId, milestoneId, delta) => {
  const course = findCourse(courseId);
  const milestone = course?.milestones.find((m) => m.id === milestoneId);
  if (!milestone?.prep) return;
  const { prep } = milestone;
  const done = Math.min(prep.total, Math.max(0, prep.done + delta));
  if (done === prep.done) return;
  const next = { ...milestone, prep: { ...prep, done } };
  const milestones = course.milestones.map((m) => (m.id === milestoneId ? next : m));
  commitUndoable(withCourse({ ...course, milestones }), `${milestone.title}: ${done}/${prep.total} ${prep.unit}`);
};

/** +1 from a Today row. */
const doTask = (action) => (action.kind === 'lectures'
  ? watch(action.courseId, 1)
  : stepPrep(action.courseId, action.milestoneId, 1));

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
  const link = h('a', { href: url, download: `courses-${localTodayIso()}.json` });
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
    const count = result.state.courses.length;
    if (!window.confirm(`Replace your current data with ${count} course${count === 1 ? '' : 's'}?`)) return;
    commit(result.state);
    settingsDialog.close();
    toast('Import complete.');
  } catch (error) {
    $('#settings-errors').textContent = `Could not read the file: ${error.message}`;
  }
});

// ---- Wiring ----

const markSettingsClean = guardDialog(settingsDialog);
const markCourseClean = guardDialog($('#course-dialog'));

const actions = {
  task: doTask,
  settings: () => { openSettings(); markSettingsClean(); },
  addCourse: () => { courseWizard.open(); markCourseClean(); },
};

$('#add-btn').addEventListener('click', () => actions.addCourse());
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
    localStorage.setItem(backupKey, localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY));
    state = { ...DEFAULT_STATE, courses: [] };
    toast(`Saved data could not be loaded (${loaded.error}). A copy was kept as "${backupKey}".`);
  }
  render();
};

init();
registerOffline();
