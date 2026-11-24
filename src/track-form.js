import { h, localTodayIso, newId } from './dom.js';
import { WEEKDAY_NAMES, lectureDates, releasedBy, validateTrack } from './tracks.js';
import { breakRow, readBreaks, wireAddBreak } from './break-rows.js';
import { fillExtraDates, readExtraDates, wireAddExtraDate } from './extra-date-rows.js';

const WEEK_ORDER = [0, 1, 2, 3, 4, 5, 6]; // Sun first
const DEFAULT_HOURS_PER_LECTURE = 1.5;

/**
 * Wires the lecture-track dialog. Calls onSave(track) with a validated track;
 * onDelete(id) returns an error message if the track cannot be deleted.
 */
export const createTrackForm = ({ dialog, onSave, onDelete }) => {
  const form = dialog.querySelector('form');
  const daysEl = form.querySelector('#track-days');
  const errorsEl = form.querySelector('#track-errors');
  const previewEl = form.querySelector('#track-preview');
  const deleteBtn = form.querySelector('#track-delete-btn');
  const breaksEl = form.querySelector('#track-breaks');
  const addBreakBtn = form.querySelector('#add-break-btn');
  const extrasEl = form.querySelector('#track-extras');
  let editing = null;

  daysEl.replaceChildren(...WEEK_ORDER.map((d) => h('label', { class: 'day-toggle' },
    h('input', { type: 'checkbox', name: 'weekday', value: d }),
    h('span', {}, WEEKDAY_NAMES[d]))));

  const read = () => ({
    id: editing?.id ?? newId(),
    name: form.elements.name.value.trim(),
    weekdays: [...form.querySelectorAll('[name="weekday"]:checked')].map((el) => Number(el.value)),
    startDate: form.elements.startDate.value,
    endDate: form.elements.endDate.value,
    hoursPerLecture: Number(form.elements.hoursPerLecture.value),
    watched: Number(form.elements.watched.value || 0),
    breaks: readBreaks(breaksEl),
    extraDates: readExtraDates(extrasEl),
  });

  const updatePreview = () => {
    const track = read();
    const problems = validateTrack({ ...track, watched: 0 });
    if (problems.length) {
      previewEl.textContent = '';
      return;
    }
    const total = lectureDates(track).length;
    const out = releasedBy(track, localTodayIso());
    previewEl.textContent = `${total} lectures this semester · ${out} out so far`;
  };

  const open = (track) => {
    editing = track ?? null;
    form.reset();
    errorsEl.textContent = '';
    form.querySelector('#track-dialog-title').textContent = track ? 'Edit lecture track' : 'New lecture track';
    deleteBtn.hidden = !track;
    form.elements.name.value = track?.name ?? '';
    form.elements.startDate.value = track?.startDate ?? localTodayIso();
    form.elements.endDate.value = track?.endDate ?? '';
    form.elements.hoursPerLecture.value = track?.hoursPerLecture ?? DEFAULT_HOURS_PER_LECTURE;
    form.elements.watched.value = track?.watched ?? 0;
    form.querySelectorAll('[name="weekday"]').forEach((el) => {
      el.checked = Boolean(track?.weekdays.includes(Number(el.value)));
    });
    breaksEl.replaceChildren(...(track?.breaks ?? []).map((b) => breakRow(b, updatePreview)));
    fillExtraDates(extrasEl, track?.extraDates, updatePreview);
    updatePreview();
    dialog.showModal();
  };

  form.addEventListener('input', updatePreview);

  wireAddBreak(addBreakBtn, breaksEl, updatePreview);
  wireAddExtraDate(form.querySelector('#add-extra-btn'), extrasEl, updatePreview);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const track = read();
    const validationErrors = validateTrack(track);
    const outSoFar = validationErrors.length ? 0 : releasedBy(track, localTodayIso());
    const errors = !validationErrors.length && track.watched > outSoFar
      ? [`Only ${outSoFar} lectures are out so far, so you can't have watched ${track.watched}.`]
      : validationErrors;
    if (errors.length) {
      errorsEl.textContent = errors.join(' ');
      return;
    }
    onSave(track);
    dialog.close();
  });

  deleteBtn.addEventListener('click', () => {
    if (!editing) return;
    const error = onDelete(editing.id);
    if (error) {
      errorsEl.textContent = error;
      return;
    }
    dialog.close();
  });

  return { open };
};
