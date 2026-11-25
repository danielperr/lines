// Course detail sheet body: status, lectures stepper, exams and assignments
// with prep steppers, and the semester timeline with cancel/restore/add.

import { daysBetween } from './dates.js';
import { h, formatDate, formatRelativeDays, formatShortDate } from './dom.js';
import { courseTimeline } from './course/timeline.js';
import { detailHeader, kindLabel, lectureLine, prepLine, splitTimeline, timelineRow } from './detail-model.js';
import { progressBar, stepButtons } from './view-parts.js';

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
      h('span', { class: 'detail-hero-progress-text' }, head.progressText)),
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

const lecturesSection = (course, planned, actions) => (planned.lectures ? [
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
    addLectureRow(actions.addLecture)),
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
 * addMilestone(kind), cancelLecture(iso), addLecture(iso).
 */
export const renderCourseDetail = (body, { course, planned, todayIso, actions }) => {
  body.replaceChildren(...[
    headerBand(planned),
    ...lecturesSection(course, planned, actions),
    ...milestonesSection(course, todayIso, actions),
    ...timelineSection(course, todayIso, actions),
  ].filter(Boolean));
};
