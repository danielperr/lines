// Derives the service-worker cache name from the deployed files, so every
// content change ships a byte-different sw.js and browsers install the update.
import { createHash } from 'node:crypto';

const HASH_LENGTH = 12;
const CACHE_NAME_PATTERN = /const CACHE_NAME = '([^']+)';/;
const CACHE_PREFIX = 'deadlines-shell-';

// files: [{ path, content }] — path is included so renames also change the hash.
export const hashFiles = (files) => {
  const hash = createHash('sha256');
  [...files]
    .sort((a, b) => a.path.localeCompare(b.path))
    .forEach(({ path, content }) => {
      hash.update(path);
      hash.update('\0');
      hash.update(content);
      hash.update('\0');
    });
  return hash.digest('hex').slice(0, HASH_LENGTH);
};

export const stampCacheName = (swSource, hash) => {
  if (!CACHE_NAME_PATTERN.test(swSource)) {
    throw new Error("sw.js must declare const CACHE_NAME = '...';");
  }
  return swSource.replace(CACHE_NAME_PATTERN, `const CACHE_NAME = '${CACHE_PREFIX}${hash}';`);
};

export const cacheNameFor = (hash) => `${CACHE_PREFIX}${hash}`;
