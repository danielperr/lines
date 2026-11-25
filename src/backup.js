// Backup import rules. Pure — the app wires the file picker and the prompt.

const courses = (n) => `${n} course${n === 1 ? '' : 's'}`;

/**
 * The question to ask before an import replaces `currentCount` courses with
 * `incomingCount`, or null when there is nothing to lose (first run).
 */
export const replacePrompt = (currentCount, incomingCount) => (currentCount === 0
  ? null
  : `Replace your ${courses(currentCount)} with the ${incomingCount} in this file?`);
