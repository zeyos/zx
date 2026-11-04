/**
 * Holds every bundle in `dist/` to the gzipped budget in `tools/size-budget.json`.
 *
 * A bundle grows one reasonable change at a time and nothing in a diff shows it. The budget puts
 * that growth in the diff: raising a limit means editing that file in the same change.
 * `npm run check:size` builds first; run directly, this compares whatever `dist/` already holds.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * @typedef {Object} SizeRow
 * @property {string} file File name inside `dist/`.
 * @property {number|null} size Gzipped size in bytes, or null when the file was not built.
 * @property {number|null} budget Budget in bytes, or null when the file has none.
 * @property {number|null} headroom Bytes left under the budget, negative when over it.
 */

/**
 * Compares the files directly inside a directory with their budgets. `dist/types` is not a bundle:
 * a browser never loads it, so only files at the top level count.
 * @param {string} directory Directory holding the bundles.
 * @param {Record<string, number>} budgets File name to gzipped budget in bytes.
 * @returns {{rows: SizeRow[], problems: string[]}} One row per file, and every failure in words.
 */
export function compareSizes(directory, budgets) {
  const built = readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name);
  const files = [...new Set([...Object.keys(budgets), ...built.sort()])];
  /** @type {SizeRow[]} */
  const rows = [];
  /** @type {string[]} */
  const problems = [];
  for (const file of files) {
    const size = built.includes(file) ? gzipSync(readFileSync(join(directory, file))).byteLength : null;
    const budget = budgets[file] ?? null;
    const headroom = size === null || budget === null ? null : budget - size;
    rows.push({ file, size, budget, headroom });
    if (size === null) problems.push(`${file}: has a budget but was not built`);
    else if (budget === null) problems.push(`${file}: has no budget`);
    else if (size > budget) problems.push(`${file}: ${size} bytes is ${size - budget} over its budget of ${budget}`);
  }
  return { rows, problems };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const budgets = JSON.parse(readFileSync(join(root, 'tools/size-budget.json'), 'utf8'));
  const { rows, problems } = compareSizes(join(root, 'dist'), budgets);
  console.table(rows);
  if (problems.length) {
    console.error(`Size budget failed. A deliberate increase edits tools/size-budget.json in the same change.\n  ${problems.join('\n  ')}`);
    process.exitCode = 1;
  } else {
    console.log('Every bundle is within its gzipped budget.');
  }
}
