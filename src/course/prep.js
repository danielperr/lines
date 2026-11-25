// Prep work before a milestone. It only counts toward "on track" once its
// window opens: a few days before the latest date it can start, once the user
// has started it, or once the milestone has passed.

import { addDays } from '../dates.js';
import { slackInfo } from './slack.js';

/** The prep window opens this many days before the computed start-by date. */
export const PREP_LEAD_DAYS = 3;

const round1 = (n) => Math.round(n * 10) / 10;

const remainingOf = (prep) => Math.max(0, prep.total - prep.done);

const withPrepLeft = (course) => course.milestones.filter((m) => m.prep && remainingOf(m.prep) > 0);

/** Remaining prep as slack jobs, workable from today. */
export const prepJobs = (course, todayIso) => withPrepLeft(course).map((m) => ({
  release: todayIso, due: m.date, hours: remainingOf(m.prep) * m.prep.hoursPerUnit,
}));

const summarizeOne = (m, slackAt, perDay, todayIso) => {
  const info = slackInfo(m.date, slackAt, perDay, todayIso);
  const opensOn = addDays(info.startBy, -PREP_LEAD_DAYS);
  const remaining = remainingOf(m.prep);
  return {
    milestoneId: m.id,
    title: m.title,
    kind: m.kind,
    date: m.date,
    unit: m.prep.unit,
    remaining,
    hoursPerUnit: m.prep.hoursPerUnit,
    hoursLeft: remaining * m.prep.hoursPerUnit,
    ...info,
    hoursShort: round1(Math.max(0, -info.slackHours)),
    opensOn,
    inWindow: opensOn <= todayIso || m.prep.done > 0 || info.daysToDue < 0,
  };
};

/** Unfinished prep for a course, earliest milestone first. */
export const summarizePrep = (course, slackAt, perDay, todayIso) => withPrepLeft(course)
  .map((m) => summarizeOne(m, slackAt, perDay, todayIso))
  .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
