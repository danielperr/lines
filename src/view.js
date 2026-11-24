import { EFFORT_PRESETS, itemProgress, todaysTask } from './scheduler.js';
import { h, formatDate, formatHours, formatRelativeDays } from './dom.js';
import { courseKey } from './overview.js';
import { overviewSection } from './overview-view.js';
import { trackSection } from './track-view.js';
import { progressBar, statusPill, stepButtons, slackText, unitLabel } from './view-parts.js';

const effortLabel = (effort) => (effort.kind === 'track' ? `${effort.trackName} lectures` : EFFORT_PRESETS[effort.type].label);

const summaryLabel = (effort) => (effort.kind === 'track' ? 'Lectures' : EFFORT_PRESETS[effort.type].label);

const partsSummary = (item) => [...new Set(item.effort.map(summaryLabel))].join(' + ');

const subtitle = (item) => [item.course, partsSummary(item)].filter(Boolean).join(' · ');

const stepHandlers = (item, effort, actions) => (effort.kind === 'track'
  ? { onMinus: () => actions.watch(effort.trackId, -1), onPlus: () => actions.watch(effort.trackId, 1) }
  : { onMinus: () => actions.step(item.id, effort.partId, -1), onPlus: () => actions.step(item.id, effort.partId, 1) });

const effortRow = (item, effort, actions) => {
  const { onMinus, onPlus } = stepHandlers(item, effort, actions);
  const unitName = unitLabel(1, effort.unit);
  const count = effort.kind === 'track'
    ? `${effort.done}/${effort.total}${effort.available > 0 ? ` · ${effort.available} ready` : ''}`
    : `${effort.done}/${effort.total} ${effort.unit}`;
  return h('div', { class: 'part' },
    h('div', { class: 'part-info' },
      h('span', { class: 'part-label' }, effortLabel(effort)),
      h('span', { class: 'part-count' }, count),
      progressBar(effort.total ? effort.done / effort.total : 1, 'thin')),
    stepButtons({
      minusLabel: `Undo one ${unitName} of ${item.title}`,
      plusLabel: `Mark one ${unitName} of ${item.title} done`,
      canMinus: effort.done > 0,
      canPlus: effort.available > 0,
      onMinus,
      onPlus,
    }));
};

const effortList = (item, actions) =>
  h('div', { class: 'parts' }, item.effort.map((effort) => effortRow(item, effort, actions)));

const metaLine = (item) => h('div', { class: 'card-meta' },
  item.hoursLeft > 0 ? h('span', {}, `${formatHours(item.hoursLeft)} left`) : h('span', {}, 'Done'),
  h('span', {}, `Due ${formatDate(item.due)}${item.daysToDue !== undefined ? ` (${formatRelativeDays(item.daysToDue)})` : ''}`));

const itemCard = (item, actions) => {
  const isOpen = Boolean(item.status);
  return h('article', {
    class: `card status-${item.status ?? 'done'}`,
    'data-course': courseKey(item.course),
    tabindex: 0,
    onClick: () => actions.edit(item.id),
    onKeydown: (e) => { if (e.key === 'Enter' && e.target === e.currentTarget) actions.edit(item.id); },
  },
  h('div', { class: 'card-top' },
    h('div', { class: 'card-titles' },
      h('h3', {}, item.title),
      h('p', { class: 'muted' }, subtitle(item))),
    isOpen ? statusPill(item.status) : null),
  progressBar(itemProgress(item)),
  metaLine(item),
  isOpen ? h('p', { class: 'slack' }, slackText(item)) : null,
  isOpen ? effortList(item, actions) : null);
};

const todayText = (tasks) => {
  if (tasks.length === 0) return 'Today: nothing available yet — waiting on lecture releases';
  const units = tasks.map((t) => `${t.units} ${unitLabel(t.units, t.unit)}`).join(' + ');
  const hours = tasks.reduce((sum, t) => sum + t.hours, 0);
  return `Today: ${units} (~${formatHours(hours)})`;
};

const nextUpCard = (item, weeklyHours, actions) => h('section', {
  class: `next-up status-${item.status}`, 'aria-label': 'Next up', 'data-course': courseKey(item.course),
},
  h('div', { class: 'card-top' },
    h('p', { class: 'eyebrow' }, 'Next up'),
    statusPill(item.status)),
  h('h2', {}, item.title),
  h('p', { class: 'muted' }, subtitle(item)),
  h('p', { class: 'today' }, todayText(todaysTask(item, weeklyHours))),
  progressBar(itemProgress(item)),
  metaLine(item),
  h('p', { class: 'slack' }, slackText(item)),
  effortList(item, actions),
  h('div', { class: 'next-actions' },
    h('button', { class: 'btn btn-gray', type: 'button', onClick: () => actions.edit(item.id) }, 'Edit')));

const summary = (active, tracks, weeklyHours, onSettings) => {
  const trackHours = tracks.filter((t) => t.linkedTitles.length === 0).reduce((sum, t) => sum + t.hoursLeft, 0);
  const total = active.reduce((sum, item) => sum + item.hoursLeft, 0) + trackHours;
  const atRisk = active.filter((item) => item.status === 'behind' || item.status === 'overdue').length;
  return h('div', { class: 'summary' },
    h('span', {}, `${active.length} open · ${formatHours(total)} of work`),
    atRisk ? h('span', { class: 'risk' }, `${atRisk} at risk`) : null,
    h('button', { class: 'btn-plain', type: 'button', onClick: onSettings }, `${weeklyHours}h / week`));
};

const welcome = (onAddCourse) => h('div', { class: 'empty welcome' },
  h('h2', {}, 'Let\'s set up your semester'),
  h('p', { class: 'muted' }, 'Add one course at a time: its lecture days, exams and assignments. The app then works out what to do each day.'),
  h('button', { class: 'btn btn-filled', type: 'button', onClick: onAddCourse }, 'Add your first course'));

const coursesHead = (hidden, onAddCourse) => (hidden ? null : h('div', { class: 'section-head' },
  h('h2', { class: 'section-title' }, 'Courses'),
  h('button', { class: 'btn-plain', type: 'button', onClick: onAddCourse }, '+ Course')));

export const renderApp = (root, { plan, weeklyHours, actions }) => {
  const { active, done, tracks } = plan;
  const empty = active.length === 0 && done.length === 0;
  const sections = [
    summary(active, tracks, weeklyHours, actions.settings),
    coursesHead(empty && tracks.length === 0, actions.addCourse),
    overviewSection(plan, actions.jump),
    empty && tracks.length === 0 ? welcome(actions.addCourse) : null,
    empty && tracks.length > 0 ? h('div', { class: 'empty' },
      h('h2', {}, 'No deadlines yet'),
      h('p', { class: 'muted' }, 'Tap + to add an exam or assignment.')) : null,
    active[0] ? nextUpCard(active[0], weeklyHours, actions) : null,
    trackSection(tracks, actions),
    active.length > 1 ? h('h2', { class: 'section-title' }, 'Other deadlines, most urgent first') : null,
    ...active.slice(1).map((item) => itemCard(item, actions)),
    done.length ? h('details', { class: 'done' },
      h('summary', {}, `Completed (${done.length})`),
      ...done.map((item) => itemCard(item, actions))) : null,
  ];
  root.replaceChildren(...sections.filter(Boolean));
};
