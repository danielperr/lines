import { test } from 'node:test';
import assert from 'node:assert/strict';
import { catchUp, nextDeadline } from '../src/home-stats.js';

const course = (id, overrides = {}) => ({ id, name: id.toUpperCase(), lectures: null, nextMilestone: null, ...overrides });
const milestone = (title, date, daysTo) => ({ id: title, kind: 'exam', title, date, daysTo });
const lectures = (behind, hoursPerLecture = 1.5) => ({ total: 10, released: 4, watched: 4 - behind, behind, hoursBehind: behind * hoursPerLecture });

test('nextDeadline picks the soonest milestone across courses', () => {
  const result = nextDeadline([
    course('a', { nextMilestone: milestone('Final', '2026-12-20', 24) }),
    course('b', { nextMilestone: milestone('Quiz', '2026-12-03', 7) }),
    course('c'),
  ]);
  assert.deepEqual(result, { courseId: 'b', courseName: 'B', title: 'Quiz', date: '2026-12-03', daysTo: 7 });
});

test('nextDeadline breaks a same-day tie by course name', () => {
  const result = nextDeadline([
    course('z', { nextMilestone: milestone('HW', '2026-12-03', 7) }),
    course('m', { nextMilestone: milestone('Lab', '2026-12-03', 7) }),
  ]);
  assert.equal(result.courseId, 'm');
});

test('nextDeadline is null when no course has a milestone ahead', () => {
  assert.equal(nextDeadline([course('a'), course('b')]), null);
  assert.equal(nextDeadline([]), null);
});

test('catchUp totals released, unwatched lectures and their hours', () => {
  const result = catchUp([
    course('a', { lectures: lectures(2, 1.5) }),
    course('b', { lectures: lectures(1, 2) }),
    course('c'),
  ]);
  assert.deepEqual(result, { lectures: 3, hours: 5, courses: 2 });
});

test('catchUp reports zero when every course is caught up', () => {
  assert.deepEqual(catchUp([course('a', { lectures: lectures(0) })]), { lectures: 0, hours: 0, courses: 0 });
});

test('catchUp is null when no course has lectures', () => {
  assert.equal(catchUp([course('a'), course('b')]), null);
});
