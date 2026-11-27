// Course detail sheet body: status, lectures stepper, exams and assignments
// with prep steppers, and the semester timeline with cancel/restore/add.

import { addDays, daysBetween } from './dates.js';
import { h, formatDate, formatRelativeDays, formatShortDate } from './dom.js';
import { activeSnooze, defaultSnoozeUntil } from './course/snooze.js';
import { courseTimeline } from './course/timeline.js';
import { detailHeader, kindLabel, lectureLine, prepLine, splitTimeline, timelineRow } from './detail-model.js';
import { progressBar, stepButtons } from './view-parts.js';

// Key for the two bar layers; the bar itself carries the spoken label.
const progressLegend = (legend) => h('div', { class: 'progress-legend', 'aria-hidden': 'true' },
  h('span', { class: 'legend-watched' }, legend.watched),
  legend.out ? h('span', { class: 'legend-out' }, legend.out) : null);

// Header band in the course's solid color. The name repeats the sheet title,
// which stays the dialog's accessible name, so it is hidden from screen readers.
const headerBand = (planned) => {
  const head = detailHeader(planned);
  return h('section', { class: `detail-hero status-${head.status}`, 'aria-label': 'Status' },
    h('div', { class: 'detail-hero-top' },
      h('p', { class: 'detail-hero-name', 'aria-hidden': 'true' }, head.name),
      h('span', { class: 'pill' }, head.pillText)),
    h('p', { class: 'detail-hero-status' }, head.statusText),
    head.progress === null ? null : h('div', { class: 'detail-hero-progress' },
      progressBar(head.progress),
      progressLegend(head.progress.legend)),
    planned.nextPrep
      ? h('p', { class: 'detail-hero-note' }, `${planned.nextPrep.title} prep starts ${formatDate(planned.nextPrep.opensOn)}`)
      : null);
};

const addLectureRow = (onAdd) => {
  const input = h('input', { type: 'date', 'aria-label': 'Date of the extra lecture' });
  return h('li', { class: 'detail-row add-lecture' },
    h('span', { class: 'detail-row-title' }, 'Extra lecture on'),
    input,
    h('button', { class: 'btn-plain', type: 'button', onClick: () => { if (input.value) onAdd(input.value); } }, 'Add'));
};

// Recordings not up yet? Keep this course out of Today for a while.
const snoozeRow = (course, todayIso, actions) => {
  const until = activeSnooze(course, todayIso);
  if (until) {
    return h('li', { class: 'detail-row snooze-row' },
      h('span', { class: 'detail-row-title' }, `Off Today until ${formatDate(until)}`),
      h('button', { class: 'btn-plain', type: 'button', 'aria-label': `Put ${course.name} back on Today`, onClick: actions.unsnooze }, 'Resume'));
  }
  const input = h('input', {
    type: 'date', min: addDays(todayIso, 1), value: defaultSnoozeUntil(todayIso), 'aria-label': 'Snooze course until',
  });
  return h('li', { class: 'detail-row snooze-row' },
    h('span', { class: 'detail-row-title' }, 'Snooze until'),
    input,
    h('button', { class: 'btn-plain', type: 'button', 'aria-label': `Snooze ${course.name}`, onClick: () => actions.snooze(input.value) }, 'Snooze'));
};

const lecturesSection = (course, planned, todayIso, actions) => (planned.lectures ? [
  h('h3', { class: 'group-header' }, 'Lectures'),
  h('ul', { class: 'list' },
    h('li', { class: 'detail-row' },
      h('span', { class: 'detail-row-title' }, lectureLine(planned.lectures)),
      stepButtons({
        minusLabel: `Undo one watched lecture of ${course.name}`,
        plusLabel: `Mark the next lecture of ${course.name} watched`,
        canMinus: course.watched > 0,
        canPlus: course.watched < planned.lectures.released,
        onMinus: () => actions.watch(-1),
        onPlus: () => actions.watch(1),
      })),
    addLectureRow(actions.addLecture),
    snoozeRow(course, todayIso, actions)),
] : []);

const milestoneItem = (m, todayIso, actions) => {
  const days = daysBetween(todayIso, m.date);
  return h('li', {
    class: 'detail-row milestone-row',
    tabindex: 0,
    onClick: () => actions.editMilestone(m.id),
    onKeydown: (e) => { if (e.key === 'Enter' && e.target === e.currentTarget) actions.editMilestone(m.id); },
  },
  h('div', { class: 'detail-row-text' },
    h('span', { class: 'detail-row-title' }, m.title),
    h('span', { class: 'detail-row-note' }, `${kindLabel(m.kind)} · ${formatDate(m.date)} (${formatRelativeDays(days)})`),
    m.prep ? h('span', { class: 'detail-row-note' }, prepLine(m.prep)) : null),
  m.prep ? stepButtons({
    minusLabel: `Undo one ${m.prep.unit.replace(/s$/, '')} of ${m.title} prep`,
    plusLabel: `Mark one ${m.prep.unit.replace(/s$/, '')} of ${m.title} prep done`,
    canMinus: m.prep.done > 0,
    canPlus: m.prep.done < m.prep.total,
    onMinus: () => actions.stepPrep(m.id, -1),
    onPlus: () => actions.stepPrep(m.id, 1),
  }) : null);
};

const milestonesSection = (course, todayIso, actions) => [
  h('h3', { class: 'group-header' }, 'Exams & assignments'),
  course.milestones.length
    ? h('ul', { class: 'list' }, course.milestones.map((m) => milestoneItem(m, todayIso, actions)))
    : h('p', { class: 'list list-empty muted' }, 'None yet.'),
  h('div', { class: 'detail-add-row' },
    h('button', { class: 'add-row', type: 'button', onClick: () => actions.addMilestone('exam') }, 'Exam'),
    h('button', { class: 'add-row', type: 'button', onClick: () => actions.addMilestone('assignment') }, 'Assignment')),
];

const timelineItem = (entry, actions) => {
  const row = timelineRow(entry);
  const run = row.action && (row.action.op === 'cancel' ? () => actions.cancelLecture(entry.date) : () => actions.addLecture(entry.date));
  return h('li', { class: `timeline-row timeline-${row.state}` },
    h('span', { class: 'timeline-date' }, formatShortDate(entry.date)),
    h('span', { class: 'timeline-title' }, row.title, row.note ? h('span', { class: 'timeline-note' }, ` · ${row.note}`) : null),
    row.action
      ? h('button', { class: 'btn-plain timeline-action', type: 'button', 'aria-label': `${row.action.label} ${row.title.toLowerCase()} on ${formatDate(entry.date)}`, onClick: run }, row.action.label)
      : null);
};

const timelineSection = (course, todayIso, actions) => {
  const { earlier, upcoming } = splitTimeline(courseTimeline(course, todayIso));
  return [
    h('h3', { class: 'group-header' }, 'Semester'),
    earlier.length ? h('details', { class: 'timeline-earlier' },
      h('summary', {}, `Earlier (${earlier.length})`),
      h('ul', { class: 'list timeline' }, earlier.map((e) => timelineItem(e, actions)))) : null,
    h('ul', { class: 'list timeline' }, upcoming.map((e) => timelineItem(e, actions))),
  ];
};

/**
 * `actions`: watch(delta), stepPrep(milestoneId, delta), editMilestone(id),
 * addMilestone(kind), cancelLecture(iso), addLecture(iso), snooze(iso), unsnooze().
 */
export const renderCourseDetail = (body, { course, planned, todayIso, actions }) => {
  body.replaceChildren(...[
    headerBand(planned),
    ...lecturesSection(course, planned, todayIso, actions),
    ...milestonesSection(course, todayIso, actions),
    ...timelineSection(course, todayIso, actions),
  ].filter(Boolean));
};
