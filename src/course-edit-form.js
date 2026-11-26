// Wires the "Edit course" sheet: name, weekly lecture schedule, breaks, extra
// lectures and watched count. Cancelled single lectures are kept as they are
// (managed from the course timeline) and pruned if they stop being lecture days.

import { h, localTodayIso } from './dom.js';
import { applyDetails, detailsErrors } from './course/edit.js';
import { WEEKDAY_NAMES, lectureDates, releasedBy, validateSchedule } from './course/schedule.js';
import { breakRow, readBreaks, wireAddBreak } from './break-rows.js';
import { fillExtraDates, readExtraDates, wireAddExtraDate } from './extra-date-rows.js';
import { createSwatchPicker } from './swatch-picker.js';

const WEEK_ORDER = [0, 1, 2, 3, 4, 5, 6]; // Sun first
const DEFAULT_HOURS_PER_LECTURE = 1.5;

/**
 * onSave(course) gets the validated course; onDelete(id) deletes it.
 * getOtherNames(id) returns the names of every other course.
 */
export const createCourseEditForm = ({ dialog, onSave, onDelete, getOtherNames }) => {
  const form = dialog.querySelector('form');
  const $ = (selector) => form.querySelector(selector);
  const daysEl = $('#course-edit-days');
  const errorsEl = $('#course-edit-errors');
  const previewEl = $('#course-edit-preview');
  const breaksEl = $('#course-edit-breaks');
  const extrasEl = $('#course-edit-extras');
  const lectureFields = $('#course-edit-lecture-fields');
  const swatches = createSwatchPicker({ container: $('#course-edit-swatches'), dialog });
  let editing = null;

  daysEl.replaceChildren(...WEEK_ORDER.map((d) => h('label', { class: 'day-toggle' },
    h('input', { type: 'checkbox', name: 'weekday', value: d }),
    h('span', {}, WEEKDAY_NAMES[d]))));

  const readSchedule = () => ({
    weekdays: [...form.querySelectorAll('[name="weekday"]:checked')].map((el) => Number(el.value)),
    startDate: form.elements.startDate.value,
    endDate: form.elements.endDate.value,
    hoursPerLecture: Number(form.elements.hoursPerLecture.value),
    breaks: readBreaks(breaksEl),
    addedDates: [...readExtraDates(extrasEl)].sort(),
    removedDates: editing?.schedule?.removedDates ?? [],
  });

  const readCourse = () => {
    const hasLectures = form.elements.hasLectures.checked;
    return applyDetails(editing, {
      name: form.elements.name.value,
      schedule: hasLectures ? readSchedule() : null,
      watched: Number(form.elements.watched.value || 0),
      color: swatches.get(),
    });
  };

  const updatePreview = () => {
    const course = readCourse();
    const ok = course.schedule && validateSchedule(course.schedule).length === 0;
    previewEl.textContent = ok
      ? `${lectureDates(course.schedule).length} lectures this semester · ${releasedBy(course.schedule, localTodayIso())} out so far`
      : '';
  };

  const syncLectureToggle = () => {
    lectureFields.hidden = !form.elements.hasLectures.checked;
    updatePreview();
  };

  const fill = (course) => {
    const schedule = course.schedule;
    form.elements.name.value = course.name;
    form.elements.hasLectures.checked = Boolean(schedule);
    form.elements.startDate.value = schedule?.startDate ?? localTodayIso();
    form.elements.endDate.value = schedule?.endDate ?? '';
    form.elements.hoursPerLecture.value = schedule?.hoursPerLecture ?? DEFAULT_HOURS_PER_LECTURE;
    form.elements.watched.value = course.watched;
    form.querySelectorAll('[name="weekday"]').forEach((el) => {
      el.checked = Boolean(schedule?.weekdays.includes(Number(el.value)));
    });
    breaksEl.replaceChildren(...(schedule?.breaks ?? []).map((b) => breakRow(b, updatePreview)));
    fillExtraDates(extrasEl, schedule?.addedDates ?? [], updatePreview);
  };

  /** `color` is the course's resolved color key (its stored or fallback one). */
  const open = (course, color) => {
    editing = course;
    form.reset();
    errorsEl.textContent = '';
    fill(course);
    swatches.set(color);
    syncLectureToggle();
    dialog.showModal();
  };

  form.addEventListener('input', updatePreview);
  form.elements.hasLectures.addEventListener('change', syncLectureToggle);
  wireAddBreak($('#course-edit-add-break'), breaksEl, updatePreview);
  wireAddExtraDate($('#course-edit-add-extra'), extrasEl, updatePreview);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!editing) return;
    const course = readCourse();
    const errors = detailsErrors(course, getOtherNames(editing.id), localTodayIso());
    if (errors.length) {
      errorsEl.textContent = errors.join(' ');
      return;
    }
    onSave(course);
    dialog.close();
  });

  $('#course-delete-btn').addEventListener('click', () => {
    if (!editing) return;
    dialog.close();
    onDelete(editing.id);
  });

  return { open };
};
