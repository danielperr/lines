// Converts between a milestone and the string values of the milestone sheet.

import { PREP_PRESETS, validateMilestone } from './milestone.js';

/** Form values for a milestone, or for a new one of `kind` (prep pre-filled from the kind's preset). */
export const draftFromMilestone = (milestone, kind = 'exam') => {
  if (!milestone) {
    const preset = PREP_PRESETS[kind];
    return { kind, title: '', date: '', hasPrep: false, unit: preset.unit, total: '', done: '0', hoursPerUnit: String(preset.hoursPerUnit) };
  }
  const prep = milestone.prep ?? { ...PREP_PRESETS[milestone.kind], total: '', done: 0 };
  return {
    kind: milestone.kind,
    title: milestone.title,
    date: milestone.date,
    hasPrep: Boolean(milestone.prep),
    unit: prep.unit,
    total: String(prep.total),
    done: String(prep.done),
    hoursPerUnit: String(prep.hoursPerUnit),
  };
};

const toNumber = (text) => (String(text).trim() === '' ? Number.NaN : Number(text));

/** Returns { ok: true, milestone } or { ok: false, errors }. */
export const milestoneFromDraft = (draft, id) => {
  const prep = draft.hasPrep
    ? { unit: draft.unit.trim(), total: toNumber(draft.total), done: toNumber(draft.done || '0'), hoursPerUnit: toNumber(draft.hoursPerUnit) }
    : null;
  const milestone = { id, kind: draft.kind, title: draft.title.trim(), date: draft.date, prep };
  const errors = validateMilestone(milestone);
  return errors.length ? { ok: false, errors } : { ok: true, milestone };
};
