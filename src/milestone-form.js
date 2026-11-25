// Wires the exam/assignment sheet. Values go through milestone-draft.js, which
// does the conversion and validation.

import { newId } from './dom.js';
import { PREP_PRESETS } from './course/milestone.js';
import { draftFromMilestone, milestoneFromDraft } from './course/milestone-draft.js';
import { kindLabel } from './detail-model.js';

const TEXT_FIELDS = ['kind', 'title', 'date', 'unit', 'total', 'done', 'hoursPerUnit'];

/** onSave(courseId, milestone); onDelete(courseId, milestoneId). */
export const createMilestoneForm = ({ dialog, onSave, onDelete }) => {
  const form = dialog.querySelector('form');
  const $ = (selector) => form.querySelector(selector);
  const errorsEl = $('#milestone-errors');
  const titleEl = $('#milestone-dialog-title');
  const deleteBtn = $('#milestone-delete-btn');
  let courseId = null;
  let editing = null;
  let lastKind = 'exam';

  const readDraft = () => ({
    ...Object.fromEntries(TEXT_FIELDS.map((name) => [name, form.elements[name].value])),
    hasPrep: form.elements.hasPrep.checked,
  });

  const fill = (draft) => {
    TEXT_FIELDS.forEach((name) => { form.elements[name].value = draft[name]; });
    form.elements.hasPrep.checked = draft.hasPrep;
  };

  const syncPrep = () => { $('#milestone-prep-fields').hidden = !form.elements.hasPrep.checked; };

  const syncTitle = () => {
    const kind = kindLabel(form.elements.kind.value);
    titleEl.textContent = editing ? `Edit ${kind.toLowerCase()}` : `New ${kind.toLowerCase()}`;
  };

  /** For a new milestone, switching kind swaps in that kind's prep unit unless the user changed it. */
  const onKindChange = (previousKind) => {
    syncTitle();
    if (editing || form.elements.unit.value !== PREP_PRESETS[previousKind].unit) return;
    const preset = PREP_PRESETS[form.elements.kind.value];
    form.elements.unit.value = preset.unit;
    form.elements.hoursPerUnit.value = preset.hoursPerUnit;
  };

  const open = (forCourseId, milestone, kind = 'exam') => {
    courseId = forCourseId;
    editing = milestone ?? null;
    form.reset();
    errorsEl.textContent = '';
    fill(draftFromMilestone(editing, kind));
    deleteBtn.hidden = !editing;
    lastKind = form.elements.kind.value;
    syncPrep();
    syncTitle();
    dialog.showModal();
  };

  form.elements.kind.addEventListener('change', () => {
    onKindChange(lastKind);
    lastKind = form.elements.kind.value;
  });
  form.elements.hasPrep.addEventListener('change', syncPrep);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const result = milestoneFromDraft(readDraft(), editing?.id ?? newId());
    if (!result.ok) {
      errorsEl.textContent = result.errors.join(' ');
      return;
    }
    onSave(courseId, result.milestone);
    dialog.close();
  });

  deleteBtn.addEventListener('click', () => {
    if (!editing) return;
    dialog.close();
    onDelete(courseId, editing.id);
  });

  return { open };
};
