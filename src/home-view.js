// Home screen: today's tasks as one colored card per course, then the
// course list as tinted cards. Colors come in as a course id → key map.
import { h, formatDate, formatHours, formatRelativeDays } from './dom.js';
import { courseRow, homeStatus, todayCards, todaySummary } from './home-model.js';
import { catchUp, nextDeadline } from './home-stats.js';
import { progressBar } from './view-parts.js';
import { COLOR_KEYS } from './course/color.js';
import { celebrate, celebrationSpot } from './celebrate.js';

const summaryBar = (plan, weeklyHours, onSettings) => {
  const count = plan.courses.length;
  const status = homeStatus(plan.courses);
  return h('div', { class: 'summary' },
    h('span', { class: 'summary-text' }, todaySummary(plan.today) ?? `${count} course${count === 1 ? '' : 's'}`),
    h('span', { class: `pill status-${status.status}` }, status.text),
    h('button', { class: 'btn-plain summary-hours', type: 'button', onClick: onSettings }, `${weeklyHours}h / week`));
};

const lectureWord = (n) => `${n} lecture${n === 1 ? '' : 's'}`;

const statTile = ({ label, value, detail, color, status }) => h('div', {
  class: `stat${status ? ` status-${status}` : ''}`,
  dataset: color ? { color } : {},
},
  h('span', { class: 'stat-label' }, label),
  h('span', { class: 'stat-value' }, value),
  h('span', { class: 'stat-detail' }, detail));

const deadlineTile = (deadline, colors) => (deadline
  ? statTile({
    label: 'Next deadline',
    value: deadline.title,
    detail: `${deadline.courseName} · ${formatDate(deadline.date)} (${formatRelativeDays(deadline.daysTo)})`,
    color: colors.get(deadline.courseId),
  })
  : statTile({ label: 'Next deadline', value: 'None ahead', detail: 'No exams or assignments left' }));

const catchUpTile = (backlog) => (backlog.lectures > 0
  ? statTile({
    label: 'To catch up',
    value: formatHours(backlog.hours),
    detail: `${lectureWord(backlog.lectures)} out, not watched`,
    status: 'behind',
  })
  : statTile({ label: 'To catch up', value: 'Caught up', detail: 'Every lecture out is watched', status: 'ok' }));

// Two tiles under the summary: the soonest deadline and the lecture backlog.
const statsRow = (courses, colors) => {
  const backlog = catchUp(courses);
  return h('div', { class: 'stats' },
    deadlineTile(nextDeadline(courses), colors),
    backlog ? catchUpTile(backlog) : null);
};

// Positions are read before the task redraws the screen; the effect plays after.
const celebrateTask = (button, runTask) => {
  const spot = celebrationSpot(button);
  runTask();
  celebrate(spot);
};

const taskItem = (row, onTask) => h('li', { class: 'task' },
  h('div', { class: 'task-text' },
    h('span', { class: 'task-title' }, row.title),
    h('span', { class: 'task-detail' }, row.detail)),
  h('button', { class: 'step plus task-done', type: 'button', 'aria-label': row.plusLabel, onClick: (e) => celebrateTask(e.currentTarget, () => onTask(row.action)) }, '+1'));

const todayCard = (card, onTask) => h('section', { class: 'today-card', dataset: { color: card.color, courseId: card.courseId }, 'aria-label': card.courseName },
  h('div', { class: 'today-card-head' },
    h('h3', { class: 'today-card-name' }, card.courseName),
    card.hoursText ? h('span', { class: 'today-card-hours' }, card.hoursText) : null),
  h('ul', { class: 'today-card-tasks' }, card.rows.map((row) => taskItem(row, onTask))));

const todaySection = (tasks, colors, onTask) => {
  const cards = todayCards(tasks, colors);
  return h('section', { class: 'today-section', 'aria-label': 'Today' },
    cards.length
      ? cards.map((card) => todayCard(card, onTask))
      : h('p', { class: 'list list-empty muted' }, 'Nothing to do today. You\'re caught up.'));
};

const milestoneLine = ({ title, date, daysTo }) => `${title} · ${formatDate(date)} (${formatRelativeDays(daysTo)})`;

const openOnKey = (onOpen, id) => (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); onOpen(id); }
};

const courseItem = (course, color, onOpen) => {
  const row = courseRow(course, color);
  const meta = [
    row.milestone ? milestoneLine(row.milestone) : null,
    row.snoozedUntil ? `Snoozed until ${formatDate(row.snoozedUntil)}` : null,
    row.prepNotice ? `${row.prepNotice.title} prep starts ${formatDate(row.prepNotice.opensOn)}` : null,
    row.lecturesText,
  ].filter(Boolean);
  return h('li', {
    class: `course-card status-${row.status}`,
    role: 'button',
    tabindex: 0,
    'aria-label': `${row.label} Open course.`,
    dataset: { courseId: row.id, color: row.color },
    onClick: () => onOpen(row.id),
    onKeydown: openOnKey(onOpen, row.id),
  },
    h('div', { class: 'course-top' },
      h('span', { class: 'course-dot', 'aria-hidden': 'true' }),
      h('span', { class: 'course-name' }, row.name),
      h('span', { class: 'pill' }, row.pillText)),
    row.signals.length
      ? h('div', { class: 'course-signals' }, row.signals.map((s) => h('span', { class: `status-${s.status}` }, s.text)))
      : null,
    row.progress === null ? null : progressBar(row.progress),
    meta.length ? h('div', { class: 'course-meta' }, meta.map((line) => h('span', {}, line))) : null);
};

const coursesSection = (courses, colors, onAddCourse, onOpen) => h('section', { class: 'courses-section', 'aria-label': 'Courses' },
  h('div', { class: 'section-head' },
    h('h2', { class: 'section-title' }, 'Courses'),
    h('button', { class: 'btn-plain', type: 'button', onClick: onAddCourse }, '+ Course')),
  h('ul', { class: 'course-list' }, courses.map((course) => courseItem(course, colors.get(course.id), onOpen))));

// Decorative: a row of the course colors hints at what the app will look like.
const paletteRow = () => h('div', { class: 'welcome-palette', 'aria-hidden': 'true' },
  COLOR_KEYS.map((key) => h('span', { dataset: { color: key } })));

const welcome = (onAddCourse, onImport) => h('div', { class: 'empty welcome' },
  paletteRow(),
  h('h2', {}, 'Let\'s set up your semester'),
  h('p', { class: 'muted' }, 'Add one course at a time: its lecture days, exams and assignments. The app then works out what to do each day.'),
  h('button', { class: 'btn btn-filled', type: 'button', onClick: onAddCourse }, 'Add your first course'),
  h('div', { class: 'welcome-import' },
    h('p', { class: 'muted' }, 'Moving from another device?'),
    h('button', { class: 'btn-plain', type: 'button', onClick: onImport }, 'Import a backup')));

/**
 * `colors`: Map of course id → color key (see colorsById).
 * `actions`: { task(action), addCourse(), settings(), openCourse(id), importBackup() }.
 */
export const renderHome = (root, { plan, colors, weeklyHours, actions }) => {
  const sections = plan.courses.length === 0
    ? [welcome(actions.addCourse, actions.importBackup)]
    : [
      summaryBar(plan, weeklyHours, actions.settings),
      statsRow(plan.courses, colors),
      todaySection(plan.today, colors, actions.task),
      coursesSection(plan.courses, colors, actions.addCourse, actions.openCourse),
    ];
  root.replaceChildren(...sections);
};
