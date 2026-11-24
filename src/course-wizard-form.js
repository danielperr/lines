// Wires the step-by-step "Add course" dialog. The logic (validation, building
// the track and deadlines) lives in course-wizard.js; this file only moves
// values between the DOM and a draft.

import { h, formatDate, localTodayIso, newId } from './dom.js';
import { WIZARD_STEPS, blankDeadline, blankDraft, buildCourse, courseSummary, stepErrors } from './course-wizard.js';
import { courseKey } from './overview.js';
import { WEEKDAY_NAMES, lectureDates, releasedBy } from './tracks.js';
import { readBreaks, wireAddBreak } from './break-rows.js';
import { readExtraDates, wireAddExtraDate } from './extra-date-rows.js';
import { deadlineRow, readDeadline, renumberRows, setLecturesAvailable } from './wizard-deadline-row.js';

const WEEK_ORDER = [0, 1, 2, 3, 4, 5, 6]; // Sun first
const STEP_NAMES = Object.freeze({ name: 'Name', lectures: 'Lectures', deadlines: 'Exams & assignments', review: 'Review' });

const summaryList = (summary) => h('div', { class: 'wizard-summary-body' },
  h('h3', {}, 'Lectures'),
  h('p', {}, summary.lectures ?? 'No weekly lectures'),
  h('h3', {}, 'Exams & assignments'),
  summary.deadlines.length
    ? h('ul', { class: 'wizard-summary-list' }, summary.deadlines.map((d) => h('li', {},
      h('span', { class: 'wizard-summary-title' }, d.title),
      h('span', { class: 'muted' }, ` · ${formatDate(d.due)}${d.detail ? ` · ${d.detail}` : ''}`))))
    : h('p', { class: 'muted' }, 'None yet — add them any time with +.'));

/**
 * Calls onSave({ track, items }) with a validated course. getCourseNames()
 * returns the names already in use, to point out when a course already exists.
 */
export const createCourseWizard = ({ dialog, onSave, getCourseNames }) => {
  const form = dialog.querySelector('form');
  const $ = (selector) => form.querySelector(selector);
  const steps = [...form.querySelectorAll('[data-step]')];
  const errorsEl = $('#course-errors');
  const deadlinesEl = $('#wizard-deadlines');
  const breaksEl = $('#wizard-breaks');
  const extrasEl = $('#wizard-extras');
  const backBtn = $('#wizard-back-btn');
  const nextBtn = $('#wizard-next-btn');
  let stepIndex = 0;

  $('#wizard-days').replaceChildren(...WEEK_ORDER.map((d) => h('label', { class: 'day-toggle' },
    h('input', { type: 'checkbox', name: 'weekday', value: d }),
    h('span', {}, WEEKDAY_NAMES[d]))));

  const readDraft = () => ({
    name: form.elements.courseName.value,
    hasLectures: form.elements.hasLectures.checked,
    lectures: {
      weekdays: [...form.querySelectorAll('[name="weekday"]:checked')].map((el) => Number(el.value)),
      startDate: form.elements.startDate.value,
      endDate: form.elements.endDate.value,
      hoursPerLecture: Number(form.elements.hoursPerLecture.value),
      watched: Number(form.elements.watched.value || 0),
      breaks: readBreaks(breaksEl),
      extraDates: readExtraDates(extrasEl),
    },
    deadlines: [...deadlinesEl.querySelectorAll('.wizard-deadline')].map(readDeadline),
  });

  const today = () => localTodayIso();

  const updateNameHint = () => {
    const key = courseKey(form.elements.courseName.value);
    const existing = form.elements.courseName.value.trim()
      && getCourseNames().find((name) => courseKey(name) === key);
    const hint = $('#wizard-name-hint');
    hint.hidden = !existing;
    hint.textContent = existing ? `You already have "${existing}". What you add here joins it.` : '';
  };

  const updateLecturePreview = () => {
    const draft = readDraft();
    const ok = draft.hasLectures && stepErrors('lectures', { ...draft, lectures: { ...draft.lectures, watched: 0 } }, today()).length === 0;
    const track = { ...draft.lectures };
    $('#wizard-lecture-preview').textContent = ok
      ? `${lectureDates(track).length} lectures this semester · ${releasedBy(track, today())} out so far`
      : '';
  };

  const syncLectureToggle = () => {
    const on = form.elements.hasLectures.checked;
    $('#wizard-lecture-fields').hidden = !on;
    setLecturesAvailable(deadlinesEl, on);
    updateLecturePreview();
  };

  const syncDeadlinesEmpty = () => {
    $('#wizard-deadlines-empty').hidden = deadlinesEl.children.length > 0;
    renumberRows(deadlinesEl);
  };

  const addDeadline = (kind) => {
    const row = deadlineRow(blankDeadline(kind), {
      lecturesAvailable: form.elements.hasLectures.checked,
      onRemove: (el) => { el.remove(); syncDeadlinesEmpty(); },
    });
    deadlinesEl.append(row);
    syncDeadlinesEmpty();
    row.querySelector('input').focus();
  };

  const showStep = (index) => {
    stepIndex = index;
    const step = WIZARD_STEPS[index];
    steps.forEach((el) => { el.hidden = el.dataset.step !== step; });
    form.querySelectorAll('.wizard-dots span').forEach((dot, i) => dot.classList.toggle('on', i <= index));
    $('#wizard-progress-text').textContent = `Step ${index + 1} of ${WIZARD_STEPS.length} · ${STEP_NAMES[step]}`;
    backBtn.hidden = index === 0;
    nextBtn.textContent = step === 'review' ? 'Add course' : 'Next';
    errorsEl.textContent = '';
    if (step === 'review') $('#wizard-summary').replaceChildren(summaryList(courseSummary(readDraft(), today())));
    form.querySelector(`[data-step="${step}"] h2`).focus();
  };

  const open = () => {
    const draft = blankDraft(today());
    form.reset();
    form.elements.startDate.value = draft.lectures.startDate;
    form.elements.hoursPerLecture.value = draft.lectures.hoursPerLecture;
    form.elements.watched.value = draft.lectures.watched;
    breaksEl.replaceChildren();
    extrasEl.replaceChildren();
    deadlinesEl.replaceChildren();
    updateNameHint();
    syncLectureToggle();
    syncDeadlinesEmpty();
    dialog.showModal();
    showStep(0);
  };

  const finish = () => {
    const draft = readDraft();
    const errors = stepErrors('review', draft, today());
    if (errors.length) {
      errorsEl.textContent = errors.join(' ');
      return;
    }
    onSave(buildCourse(draft, newId));
    dialog.close();
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const step = WIZARD_STEPS[stepIndex];
    if (step === 'review') {
      finish();
      return;
    }
    const errors = stepErrors(step, readDraft(), today());
    if (errors.length) {
      errorsEl.textContent = errors.join(' ');
      return;
    }
    showStep(stepIndex + 1);
  });

  // An error describes the last Next tap; clear it as soon as the user edits.
  form.addEventListener('input', () => { errorsEl.textContent = ''; });
  backBtn.addEventListener('click', () => showStep(Math.max(0, stepIndex - 1)));
  form.elements.courseName.addEventListener('input', updateNameHint);
  form.elements.hasLectures.addEventListener('change', syncLectureToggle);
  $('#wizard-lecture-fields').addEventListener('input', updateLecturePreview);
  wireAddBreak($('#wizard-add-break-btn'), breaksEl, updateLecturePreview);
  wireAddExtraDate($('#wizard-add-extra-btn'), extrasEl, updateLecturePreview);
  $('#wizard-add-exam').addEventListener('click', () => addDeadline('exam'));
  $('#wizard-add-assignment').addEventListener('click', () => addDeadline('assignment'));

  return { open };
};
