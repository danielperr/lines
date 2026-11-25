// Home screen: today's tasks as one colored card per course, then the
// course list as tinted cards. Colors come in as a course id → key map.
import { h, formatDate, formatRelativeDays } from './dom.js';
import { courseRow, homeStatus, todayCards, todaySummary } from './home-model.js';
import { progressBar } from './view-parts.js';
import { COLOR_KEYS } from './course/color.js';

const summaryBar = (plan, weeklyHours, onSettings) => {
  const count = plan.courses.length;
  const status = homeStatus(plan.courses);
  return h('div', { class: 'summary' },
    h('span', { class: 'summary-text' }, todaySummary(plan.today) ?? `${count} course${count === 1 ? '' : 's'}`),
    h('span', { class: `pill status-${status.status}` }, status.text),
    h('button', { class: 'btn-plain summary-hours', type: 'button', onClick: onSettings }, `${weeklyHours}h / week`));
};

const taskItem = (row, onTask) => h('li', { class: 'task' },
  h('div', { class: 'task-text' },
    h('span', { class: 'task-title' }, row.title),
    h('span', { class: 'task-detail' }, row.detail)),
  h('button', { class: 'step plus task-done', type: 'button', 'aria-label': row.plusLabel, onClick: () => onTask(row.action) }, '+1'));

const todayCard = (card, onTask) => h('section', { class: 'today-card', dataset: { color: card.color }, 'aria-label': card.courseName },
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

const welcome = (onAddCourse) => h('div', { class: 'empty welcome' },
  paletteRow(),
  h('h2', {}, 'Let\'s set up your semester'),
  h('p', { class: 'muted' }, 'Add one course at a time: its lecture days, exams and assignments. The app then works out what to do each day.'),
  h('button', { class: 'btn btn-filled', type: 'button', onClick: onAddCourse }, 'Add your first course'));

/**
 * `colors`: Map of course id → color key (see colorsById).
 * `actions`: { task(action), addCourse(), settings(), openCourse(id) }.
 */
export const renderHome = (root, { plan, colors, weeklyHours, actions }) => {
  const sections = plan.courses.length === 0
    ? [welcome(actions.addCourse)]
    : [
      summaryBar(plan, weeklyHours, actions.settings),
      todaySection(plan.today, colors, actions.task),
      coursesSection(plan.courses, colors, actions.addCourse, actions.openCourse),
    ];
  root.replaceChildren(...sections);
};
