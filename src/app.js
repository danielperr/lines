import { assignColor } from './course/color.js';
import { addLecture, cancelLecture, removeMilestone, saveMilestone, setWatched, stepPrep } from './course/edit.js';
import { planCourses } from './course/planner.js';
import { releasedBy } from './course/schedule.js';
import {
  DEFAULT_STATE, LEGACY_STORAGE_KEY, STORAGE_KEY, loadState, parseState, saveState, serializeState,
} from './course/store.js';
import { h, formatDate, localTodayIso } from './dom.js';
import { guardDialog } from './change-guard.js';
import { renderCourseDetail } from './course-detail-view.js';
import { createCourseEditForm } from './course-edit-form.js';
import { createCourseWizard } from './course-wizard-form.js';
import { renderHome } from './home-view.js';
import { createMilestoneForm } from './milestone-form.js';
import { registerOffline } from './offline.js';
import { hideWhileScrollingDown } from './scroll.js';
import { createToast } from './toast.js';
import { createUndo } from './undo.js';

const $ = (selector) => document.querySelector(selector);
const root = $('#app');
const settingsDialog = $('#settings-dialog');
const settingsForm = $('#settings-form');

let state = null;
const UNDO_MS = 6000;

const { show: showToast, hide: hideToast } = createToast($('#toast'));

const undo = createUndo({ show: showToast, hide: hideToast, timeoutMs: UNDO_MS });

/** A plain message; it replaces (and cancels) any pending Undo. */
const toast = (message) => {
  undo.dismiss();
  showToast(message);
};

const render = () => {
  const plan = planCourses(state, localTodayIso());
  renderHome(root, { plan, weeklyHours: state.weeklyHours, actions });
  renderDetail(plan);
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
  const colored = assignColor(course, state.courses);
  commitUndoable({ ...state, courses: [...state.courses, colored] }, `Added "${colored.name}"`);
};

const courseWizard = createCourseWizard({
  dialog: $('#course-dialog'), onSave: addCourse, getCourseNames: () => state.courses.map((c) => c.name),
});

// ---- Course changes (all undoable) ----

/** Applies fn to one course; does nothing when fn returns the same course. */
const changeCourse = (courseId, fn, message) => {
  const course = findCourse(courseId);
  if (!course) return;
  const next = fn(course);
  if (next === course) return;
  commitUndoable(withCourse(next), message(next, course));
};

const watch = (courseId, delta) => changeCourse(courseId, (c) => setWatched(c, c.watched + delta, localTodayIso()),
  (c) => `${c.name}: ${c.watched}/${releasedBy(c.schedule, localTodayIso())} watched`);

const prepStep = (courseId, milestoneId, delta) => changeCourse(courseId, (c) => stepPrep(c, milestoneId, delta), (c) => {
  const m = c.milestones.find((x) => x.id === milestoneId);
  return `${m.title}: ${m.prep.done}/${m.prep.total} ${m.prep.unit}`;
});

const lectureChange = (courseId, iso, op) => changeCourse(courseId, (c) => (op === 'cancel' ? cancelLecture(c, iso) : addLecture(c, iso)),
  () => `${op === 'cancel' ? 'Cancelled' : 'Added'} lecture on ${formatDate(iso)}`);

const saveMilestoneTo = (courseId, milestone) => changeCourse(courseId, (c) => saveMilestone(c, milestone),
  () => `Saved "${milestone.title}"`);

const deleteMilestone = (courseId, milestoneId) => changeCourse(courseId, (c) => removeMilestone(c, milestoneId),
  (c, before) => `Deleted "${before.milestones.find((m) => m.id === milestoneId)?.title ?? 'milestone'}"`);

const saveCourse = (course) => changeCourse(course.id, () => course, () => `Saved "${course.name}"`);

const deleteCourse = (courseId) => {
  const course = findCourse(courseId);
  if (!course) return;
  detailDialog.close();
  commitUndoable({ ...state, courses: state.courses.filter((c) => c.id !== courseId) }, `Deleted "${course.name}"`);
};

/** +1 from a Today row. */
const doTask = (action) => (action.kind === 'lectures'
  ? watch(action.courseId, 1)
  : prepStep(action.courseId, action.milestoneId, 1));

// ---- Course detail, milestone and edit sheets ----

const detailDialog = $('#course-detail');
let detailCourseId = null;

const milestoneForm = createMilestoneForm({ dialog: $('#milestone-dialog'), onSave: saveMilestoneTo, onDelete: deleteMilestone });
const markMilestoneClean = guardDialog($('#milestone-dialog'));

const courseEditForm = createCourseEditForm({
  dialog: $('#course-edit-dialog'),
  onSave: saveCourse,
  onDelete: deleteCourse,
  getOtherNames: (id) => state.courses.filter((c) => c.id !== id).map((c) => c.name),
});
const markCourseEditClean = guardDialog($('#course-edit-dialog'));

const detailActions = (courseId) => ({
  watch: (delta) => watch(courseId, delta),
  stepPrep: (milestoneId, delta) => prepStep(courseId, milestoneId, delta),
  editMilestone: (id) => { milestoneForm.open(courseId, findCourse(courseId)?.milestones.find((m) => m.id === id)); markMilestoneClean(); },
  addMilestone: (kind) => { milestoneForm.open(courseId, null, kind); markMilestoneClean(); },
  cancelLecture: (iso) => lectureChange(courseId, iso, 'cancel'),
  addLecture: (iso) => lectureChange(courseId, iso, 'add'),
});

/** Redraws the open course sheet from the latest plan; closes it if the course is gone. */
const renderDetail = (plan) => {
  if (!detailCourseId) return;
  const course = findCourse(detailCourseId);
  if (!course) {
    detailDialog.close();
    return;
  }
  $('#course-detail-title').textContent = course.name;
  renderCourseDetail($('#course-detail-body'), {
    course,
    planned: plan.courses.find((c) => c.id === course.id),
    todayIso: localTodayIso(),
    actions: detailActions(course.id),
  });
};

const openCourse = (courseId) => {
  detailCourseId = courseId;
  renderDetail(planCourses(state, localTodayIso()));
  detailDialog.showModal();
};

detailDialog.addEventListener('close', () => { detailCourseId = null; });
detailDialog.querySelector('[data-detail-close]').addEventListener('click', () => detailDialog.close());
$('#course-detail-edit').addEventListener('click', () => {
  const course = findCourse(detailCourseId);
  if (!course) return;
  courseEditForm.open(course);
  markCourseEditClean();
});

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
  openCourse,
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
