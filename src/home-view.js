// Home screen: today's tasks across all courses, then the course list.
import { h, formatDate, formatRelativeDays } from './dom.js';
import { courseRow, todayRows, todaySummary } from './home-model.js';
import { progressBar } from './view-parts.js';

const AT_RISK = new Set(['behind', 'overdue']);

const summaryBar = (plan, weeklyHours, onSettings) => {
  const atRisk = plan.courses.filter((c) => AT_RISK.has(c.status)).length;
  const count = plan.courses.length;
  return h('div', { class: 'summary' },
    h('span', {}, todaySummary(plan.today) ?? `${count} course${count === 1 ? '' : 's'}`),
    atRisk ? h('span', { class: 'risk' }, `${atRisk} behind`) : null,
    h('button', { class: 'btn-plain', type: 'button', onClick: onSettings }, `${weeklyHours}h / week`));
};

const taskItem = (row, onTask) => h('li', { class: 'task' },
  h('div', { class: 'task-text' },
    h('span', { class: 'task-title' }, row.title),
    h('span', { class: 'task-detail' }, row.detail)),
  h('button', { class: 'step plus task-done', type: 'button', 'aria-label': row.plusLabel, onClick: () => onTask(row.action) }, '+1'));

const todaySection = (tasks, onTask) => {
  const rows = todayRows(tasks);
  return h('section', { class: 'today-section', 'aria-label': 'Today' },
    rows.length
      ? h('ul', { class: 'list today-list' }, rows.map((row) => taskItem(row, onTask)))
      : h('p', { class: 'list list-empty muted' }, 'Nothing to do today. You\'re caught up.'));
};

const milestoneLine = ({ title, date, daysTo }) => `${title} · ${formatDate(date)} (${formatRelativeDays(daysTo)})`;

const courseItem = (course, onOpen) => {
  const row = courseRow(course);
  const meta = [
    row.milestone ? milestoneLine(row.milestone) : null,
    row.prepNotice ? `${row.prepNotice.title} prep starts ${formatDate(row.prepNotice.opensOn)}` : null,
    row.lecturesText,
  ].filter(Boolean);
  return h('li', {
    class: `course-row status-${row.status}`,
    role: 'button',
    tabindex: 0,
    'aria-label': `${row.label} Open course.`,
    dataset: { courseId: row.id },
    onClick: () => onOpen(row.id),
    onKeydown: (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); onOpen(row.id); } },
  },
    h('div', { class: 'course-top' },
      h('span', { class: 'course-name' }, row.name),
      h('span', { class: 'course-status' }, row.statusText)),
    row.progress === null ? null : progressBar(row.progress, 'thin'),
    meta.length ? h('div', { class: 'course-meta' }, meta.map((line) => h('span', {}, line))) : null);
};

const coursesSection = (courses, onAddCourse, onOpen) => h('section', { class: 'courses-section', 'aria-label': 'Courses' },
  h('div', { class: 'section-head' },
    h('h2', { class: 'section-title' }, 'Courses'),
    h('button', { class: 'btn-plain', type: 'button', onClick: onAddCourse }, '+ Course')),
  h('ul', { class: 'list course-list' }, courses.map((course) => courseItem(course, onOpen))));

const welcome = (onAddCourse) => h('div', { class: 'empty welcome' },
  h('h2', {}, 'Let\'s set up your semester'),
  h('p', { class: 'muted' }, 'Add one course at a time: its lecture days, exams and assignments. The app then works out what to do each day.'),
  h('button', { class: 'btn btn-filled', type: 'button', onClick: onAddCourse }, 'Add your first course'));

/** `actions`: { task(action), addCourse(), settings(), openCourse(id) }. */
export const renderHome = (root, { plan, weeklyHours, actions }) => {
  const sections = plan.courses.length === 0
    ? [welcome(actions.addCourse)]
    : [
      summaryBar(plan, weeklyHours, actions.settings),
      todaySection(plan.today, actions.task),
      coursesSection(plan.courses, actions.addCourse, actions.openCourse),
    ];
  root.replaceChildren(...sections);
};
