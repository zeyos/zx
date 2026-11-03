# WP61 — A German message catalogue

Every message a component shows resolves through `msg()`, and the library ships only the English
catalogue (`src/core/messages.js`, about 490 keys). `setTranslator()` lets a host supply another
language, but each application then has to translate the whole library itself. This WP ships a
complete German catalogue as the first translation, and makes keeping it complete part of the
contract.

Work on the branch `wp/61-german-messages`, from `main`. `AGENTS.md` applies. `src/core/**` is
**not** in scope. `CHANGELOG.md` is central: report changelog lines. `docs/api.json` is
regenerated. Public files must not mention this spec.

This WP explicitly permits one rule added to `AGENTS.md` (§2).

## Decisions (binding)

1. **Same keys, same placeholders.** The German catalogue has exactly the keys of
   `defaultMessages`, and every entry keeps the placeholders (`%1`, `%2`, …, and any named ones)
   of its English text, each the same number of times.
2. **Installed through the existing seam.** A host installs it with
   `setTranslator((key) => de[key])` and `setLanguage('de')`. No new mechanism, and nothing in
   `src/core/` changes.
3. **The voice of a business application.**
   - Address the person formally ("Sie"). Prefer forms that need no address at all ("Änderungen
     speichern", not "Speichern Sie die Änderungen").
   - Buttons and menu items use the infinitive ("Speichern", "Abbrechen", "Löschen").
   - Typography: German quotation marks („…“), the ellipsis character (…), and a non-breaking space
     before a unit or a percent sign where the English text has a number.
   - Keep established software terms (Tab, Dashboard, Token, Prompt) where German software uses
     them, and keep the terms consistent across the catalogue. `docs/llms.md` lists the glossary.
4. **Complete or failing.** A test fails when any key is missing, extra or empty, or a placeholder
   differs. A change that adds an English key therefore adds its German text in the same change.

## §1 · Catalogue

**Scope:** new `src/locales/de.js`, `package.json` (`exports`: `./locales/*`), new
`tests/unit/locale-de.test.js`, `tests/unit/package-exports.test.js`, `docs/llms.md`
(Internationalisation), `website/demos/` (one demo may switch a component to German, if a natural
place exists).

- **`src/locales/de.js`** exports `de`, a frozen object in the key order of `defaultMessages`, with
  a short header comment on the voice of Decision 3.
- **Import paths:** `@zeyos/zx/locales/de.js` and `src/locales/de.js` in the repository.
- **The test** reads `defaultMessages` and `de` and checks Decision 1 and Decision 4: no missing,
  extra or empty keys; matching placeholders; and no entry identical to its English text except
  those on an explicit allowlist in the test (terms such as "OK" or "Tab" that German shares).

## §2 · Contract

**Scope:** `AGENTS.md`.

- One line under "Component conventions": a new message key gets its German text in
  `src/locales/de.js` in the same change, and `tests/unit/locale-de.test.js` enforces it.

## Out of scope

- Other languages, regional variants (`de-AT`, `de-CH`), and plural rules beyond what the English
  catalogue already does.
- Translating documentation, demos or layout content.
- Date, number and currency formatting, which already follow `locale`.

## Acceptance criteria

1. `npm test` passes; `node tools/check-site.js` and `git diff --check` are clean.
2. The test covers every key and fails on a missing, extra or empty key and on a changed
   placeholder (checked by temporarily breaking one entry, then restoring it).
3. With the catalogue installed, a smoke run over the documentation demos shows no English message
   text from the library in Select, Table, Datebox, Dialog, Composer and AgentThread. This is
   checked by hand, and the report states how.
4. Changelog lines are reported.
