import { EFFORT_PRESETS, TRACK_PART, validateItem } from './scheduler.js';
import { h, localTodayIso, newId } from './dom.js';


const typeSelect = (selected, hasTracks) => h('select', { name: 'type', 'aria-label': 'Effort type' },
  Object.entries(EFFORT_PRESETS).map(([value, preset]) =>
    h('option', { value, selected: value === selected }, preset.label)),
  hasTracks || selected === TRACK_PART
    ? h('option', { value: TRACK_PART, selected: selected === TRACK_PART }, 'Lectures from a track')
    : null);

const trackSelect = (tracks, selectedId) => h('select', { name: 'trackId', 'aria-label': 'Lecture track' },
  tracks.map((t) => h('option', { value: t.id, selected: t.id === selectedId }, t.name)));

const numberInput = (name, value, attrs) =>
  h('input', { name, type: 'number', value, required: true, ...attrs });

/**
 * One editable effort part. Values live in the DOM until the form is saved.
 * A part either counts units (unit fields) or links a lecture track (track picker).
 */
const partEditor = (part, tracks, onRemove) => {
  const isTrack = part.type === TRACK_PART;
  const preset = EFFORT_PRESETS[isTrack ? 'lectures' : part.type];
  const select = typeSelect(part.type, tracks.length > 0);
  const unit = h('input', { name: 'unit', value: part.unit ?? preset.unit, maxlength: 20 });
  const hoursPerUnit = numberInput('hoursPerUnit', part.hoursPerUnit ?? preset.hoursPerUnit, { inputmode: 'decimal', min: 0.25, step: 0.25 });
  const unitFields = h('div', { class: 'unit-fields', hidden: isTrack },
    h('div', { class: 'row' },
      h('label', {}, 'Unit name', unit),
      h('label', {}, 'Hours per unit', hoursPerUnit)),
    h('div', { class: 'row' },
      h('label', {}, 'Total', numberInput('totalUnits', part.totalUnits ?? '', { inputmode: 'numeric', min: 1, step: 1 })),
      h('label', {}, 'Already done', numberInput('doneUnits', part.doneUnits ?? 0, { inputmode: 'numeric', min: 0, step: 1 }))));
  const trackFields = h('div', { class: 'track-fields', hidden: !isTrack },
    h('label', {}, 'Lecture track', trackSelect(tracks, part.trackId)),
    h('p', { class: 'group-note' }, 'Counts the track\'s lectures released before this due date (and after any earlier linked deadline).'));
  select.addEventListener('change', () => {
    const trackChosen = select.value === TRACK_PART;
    unitFields.hidden = trackChosen;
    trackFields.hidden = !trackChosen;
    if (trackChosen) return;
    unit.value = EFFORT_PRESETS[select.value].unit;
    hoursPerUnit.value = EFFORT_PRESETS[select.value].hoursPerUnit;
  });
  return h('fieldset', { class: 'part-editor group', dataset: { partId: part.id } },
    h('div', { class: 'part-editor-top' },
      select,
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Remove this part', onClick: onRemove }, '✕')),
    unitFields,
    trackFields);
};

const blankPart = (type, tracks = []) => {
  if (type === TRACK_PART) return { id: newId(), type, trackId: tracks[0]?.id };
  const preset = EFFORT_PRESETS[type];
  return { id: newId(), type, unit: preset.unit, hoursPerUnit: preset.hoursPerUnit, totalUnits: '', doneUnits: 0 };
};

const readPart = (fieldset) => {
  const field = (name) => fieldset.querySelector(`[name="${name}"]`)?.value ?? '';
  const type = field('type');
  if (type === TRACK_PART) return { id: fieldset.dataset.partId, type, trackId: field('trackId') };
  return {
    id: fieldset.dataset.partId,
    type,
    unit: field('unit').trim() || EFFORT_PRESETS[type].unit,
    hoursPerUnit: Number(field('hoursPerUnit')),
    totalUnits: Number(field('totalUnits')),
    doneUnits: Number(field('doneUnits') || 0),
  };
};

/**
 * Wires the add/edit dialog. Calls onSave(item) with a validated item and
 * onDelete(id) when Delete is tapped (the app offers Undo).
 */
export const createItemForm = ({ dialog, onSave, onDelete, getTracks }) => {
  const form = dialog.querySelector('form');
  const partsList = form.querySelector('#parts-list');
  const errorsEl = form.querySelector('#item-errors');
  const deleteBtn = form.querySelector('#delete-btn');
  let editing = null;

  const addPartEditor = (part) => {
    const editor = partEditor(part, getTracks(), () => editor.remove());
    partsList.append(editor);
    return editor;
  };

  const open = (item) => {
    editing = item ?? null;
    form.reset();
    errorsEl.textContent = '';
    form.querySelector('#item-dialog-title').textContent = item ? 'Edit deadline' : 'New deadline';
    deleteBtn.hidden = !item;
    form.elements.title.value = item?.title ?? '';
    form.elements.course.value = item?.course ?? '';
    form.elements.due.value = item?.due ?? localTodayIso();
    partsList.replaceChildren();
    const tracks = getTracks();
    (item?.parts ?? [blankPart(tracks.length ? TRACK_PART : 'lectures', tracks)]).forEach(addPartEditor);
    dialog.showModal();
  };

  form.querySelector('#add-part-btn').addEventListener('click', () => {
    addPartEditor(blankPart('exam')).querySelector('select').focus();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const item = {
      id: editing?.id ?? newId(),
      title: form.elements.title.value.trim(),
      course: form.elements.course.value.trim(),
      due: form.elements.due.value,
      parts: [...partsList.querySelectorAll('.part-editor')].map(readPart),
    };
    const errors = validateItem(item, getTracks().map((t) => t.id));
    if (errors.length) {
      errorsEl.textContent = errors.join(' ');
      return;
    }
    onSave(item);
    dialog.close();
  });

  deleteBtn.addEventListener('click', () => {
    if (!editing) return;
    onDelete(editing.id);
    dialog.close();
  });

  return { open };
};
