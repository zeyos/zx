import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { glob } from 'node:fs/promises';

/*
 * `Component` is generic over its options type, and a subclass only gets a typed constructor if it
 * binds its own typedef with `@extends {Component<XOptions>}`. Nothing at runtime depends on that
 * line, so a component added without it works perfectly and silently ships `Record<string, any>`
 * to every TypeScript consumer — a failure that shows up in someone else's editor, not here.
 *
 * The generated declarations would catch it, but only if someone reads them. This does not.
 */
const CLASS = /export class (\w+) extends Component\b/g;
// Anchored to a real JSDoc tag — ` * @extends {…}` — so the worked example inside `Component`'s
// own docstring, which is quoted mid-sentence in backticks, is not read as a binding.
const BINDING = /^\s*\*\s*@extends \{Component<(\w+)>\}/gm;
const OPTIONS_TYPEDEF = /@typedef \{Object\} (\w+Options)\b/g;

/** @returns {Promise<{file: string, source: string}[]>} */
async function sources() {
  const root = fileURLToPath(new URL('../../src/', import.meta.url));
  const files = [];
  for await (const entry of glob('**/*.js', { cwd: root })) {
    files.push({ file: entry, source: readFileSync(root + entry, 'utf8') });
  }
  return files;
}

test('every component binds its options typedef to the Component generic', async () => {
  const missing = [];
  for (const { file, source } of await sources()) {
    const classes = [...source.matchAll(CLASS)].map((match) => match[1]);
    if (classes.length === 0) continue;
    const bound = [...source.matchAll(BINDING)].length;
    if (bound < classes.length) missing.push(`${file} (${classes.join(', ')})`);
  }
  assert.deepEqual(missing, [],
    `add "@extends {Component<XOptions>}" to the class JSDoc in: ${missing.join(', ')}`);
});

test('every binding names a typedef that exists in its own file', async () => {
  const dangling = [];
  for (const { file, source } of await sources()) {
    const declared = new Set([...source.matchAll(OPTIONS_TYPEDEF)].map((match) => match[1]));
    for (const [, name] of source.matchAll(BINDING)) {
      if (!declared.has(name)) dangling.push(`${file} -> ${name}`);
    }
  }
  assert.deepEqual(dangling, [], `these bindings name a typedef that is not declared: ${dangling.join(', ')}`);
});
