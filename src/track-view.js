import { h, formatDate, formatHours, formatRelativeDays } from './dom.js';
import { WEEKDAY_NAMES } from './tracks.js';
import { courseKey, trackTone } from './overview.js';
import { progressBar, statusPill, stepButtons } from './view-parts.js';

const trackPill = (track) => {
  if (track.status === 'done') return statusPill('done', 'All watched');
  if (track.behind === 0) return statusPill('ok', 'Caught up');
  return statusPill(trackTone(track), `${track.behind} behind`);
};

const scheduleText = (track) => track.weekdays.slice().sort().map((d) => WEEKDAY_NAMES[d]).join(', ');

const forText = (track) => (track.linkedTitles.length
  ? `For ${track.linkedTitles.join(', ')}`
  : `Not linked to an exam · due by semester end (${formatDate(track.endDate)})`);

const backlogText = (track) => {
  if (track.status === 'done') return 'Every lecture watched';
  const next = track.nextRelease ? `next ${formatDate(track.nextRelease)}` : 'no more releases';
  if (track.behind === 0) return `Up to date · ${next}`;
  return `${formatHours(track.hoursBehind)} to catch up · ${next}`;
};

const neededByText = (track) => (track.behind > 0 && track.dueBy
  ? ` · needed by ${formatDate(track.dueBy)} (${formatRelativeDays(track.daysToDue)})`
  : '');

const trackCard = (track, actions) => h('article', {
  class: `card track-card status-${trackTone(track)}`,
  'data-course': courseKey(track.name),
  tabindex: 0,
  onClick: () => actions.editTrack(track.id),
  onKeydown: (e) => { if (e.key === 'Enter' && e.target === e.currentTarget) actions.editTrack(track.id); },
},
h('div', { class: 'card-top' },
  h('div', { class: 'card-titles' },
    h('h3', {}, track.name),
    h('p', { class: 'muted' }, `${scheduleText(track)} · ${forText(track)}`)),
  trackPill(track)),
h('p', { class: 'slack' }, `${backlogText(track)}${neededByText(track)}`),
h('div', { class: 'part' },
  h('div', { class: 'part-info' },
    h('span', { class: 'part-label' }, `${Math.min(track.watched, track.released)}/${track.released} watched`),
    h('span', { class: 'part-count' }, `${track.total} this semester`),
    progressBar(track.released ? track.watched / track.released : 1, 'thin')),
  stepButtons({
    minusLabel: `Undo one ${track.name} lecture`,
    plusLabel: `Mark one ${track.name} lecture watched`,
    canMinus: track.watched > 0,
    canPlus: track.watched < track.released,
    onMinus: () => actions.watch(track.id, -1),
    onPlus: () => actions.watch(track.id, 1),
  })));

export const trackSection = (tracks, actions) => h('section', { class: 'tracks', 'aria-label': 'Lecture tracks' },
  h('div', { class: 'section-head' },
    h('h2', { class: 'section-title' }, 'Lectures'),
    h('button', { class: 'chip', type: 'button', onClick: () => actions.editTrack(null) }, '+ Track')),
  tracks.length
    ? tracks.slice().sort((a, b) => b.behind - a.behind || a.name.localeCompare(b.name)).map((t) => trackCard(t, actions))
    : h('p', { class: 'muted small' }, 'Add a course\'s lecture schedule to keep your backlog in check.'));
