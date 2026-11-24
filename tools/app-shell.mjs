// Reads the APP_SHELL list from sw.js so the build and the tests use the same file list.
import { readFileSync } from 'node:fs';

export const ROOT = new URL('../', import.meta.url);

export const readAppShell = () => {
  const source = readFileSync(new URL('sw.js', ROOT), 'utf8');
  const match = source.match(/const APP_SHELL = (\[[\s\S]*?\]);/);
  if (!match) throw new Error('sw.js must declare const APP_SHELL = [...]');
  return JSON.parse(match[1].replace(/'/g, '"').replace(/,\s*\]/, ']'));
};
