// Figures for the stat tiles at the top of the home screen, built from the
// planner's courses. Pure — dates stay ISO and are formatted by the view.

const byDateThenName = (a, b) => a.nextMilestone.date.localeCompare(b.nextMilestone.date)
  || a.name.localeCompare(b.name);

/** The soonest upcoming milestone across all courses, or null when none is ahead. */
export const nextDeadline = (courses) => {
  const [first] = courses.filter((c) => c.nextMilestone).sort(byDateThenName);
  if (!first) return null;
  const { title, date, daysTo } = first.nextMilestone;
  return { courseId: first.id, courseName: first.name, title, date, daysTo };
};

/**
 * Lectures already out but not yet watched, summed over every course with a
 * schedule: how much catching up it takes to be on track. Null when no course
 * has lectures.
 */
export const catchUp = (courses) => {
  const withLectures = courses.filter((c) => c.lectures);
  if (withLectures.length === 0) return null;
  const behind = withLectures.filter((c) => c.lectures.behind > 0);
  return {
    lectures: behind.reduce((sum, c) => sum + c.lectures.behind, 0),
    hours: behind.reduce((sum, c) => sum + c.lectures.hoursBehind, 0),
    courses: behind.length,
  };
};
