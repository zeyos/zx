/**
 * Writes the agent surface catalog's generated files from the runtime functions, so the files and
 * what an application generates at runtime cannot drift:
 *
 * - `docs/agent-catalog.json`: the catalog (every node with when to use it and when not to), the
 *   JSON Schema of one operation line and of a whole document, the `show_surface`/`ask_user` tool
 *   definitions, and what each profile keeps;
 * - `docs/agent-surfaces.md`: the model-facing guide, in tool mode.
 *
 * Run by `npm run build:catalog`. The output is deterministic, so a second run leaves no diff, and
 * `tests/unit/surface-catalog.test.js` fails when the committed files are stale.
 */
import { writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATALOG, LIMITS, PROFILES, narrowCatalog, surfacePrompt, surfaceSchema, surfaceTools } from '../src/components/surface/catalog.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

/**
 * The intents and node types each profile keeps.
 * @returns {Record<string, {intents: string[], nodes: string[]}>}
 */
export function profileContents() {
  return Object.fromEntries(PROFILES.map((profile) => {
    const narrowed = narrowCatalog(CATALOG, { profile });
    return [profile, { intents: Object.keys(narrowed.intents), nodes: Object.keys(narrowed.nodes) }];
  }));
}

/**
 * The generated files, by path relative to the repository root.
 * @returns {Record<string, string>}
 */
export function agentCatalogFiles() {
  const catalog = {
    version: CATALOG.version,
    limits: LIMITS,
    catalog: CATALOG,
    schema: surfaceSchema(CATALOG),
    tools: surfaceTools(CATALOG),
    profiles: profileContents()
  };
  return {
    'docs/agent-catalog.json': `${JSON.stringify(catalog, null, 2)}\n`,
    'docs/agent-surfaces.md': surfacePrompt(CATALOG, { mode: 'tool' })
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const [path, content] of Object.entries(agentCatalogFiles())) {
    await writeFile(join(root, path), content);
    console.log(`wrote ${path}`);
  }
}
