import { en, de } from '../../src/locales/index.js';

/** Application-owned keys extend the shipped English and German catalogues. */
export const catalogues = Object.freeze({
  'en-GB': Object.freeze({
    ...en,
    'example.preview': 'Preview',
    'example.welcome': 'Welcome, %1!',
    'example.assigned': '%person% is working on %record%.',
    'example.results.one': '%1 result',
    'example.results.other': '%1 results',
    'example.emptyCount': 'Enter a count to see its plural form.',
    'example.project': 'Project'
  }),
  'de-DE': Object.freeze({
    ...de,
    'example.preview': 'Vorschau',
    'example.welcome': 'Willkommen, %1!',
    'example.assigned': '%person% bearbeitet %record%.',
    'example.results.one': '%1 Ergebnis',
    'example.results.other': '%1 Ergebnisse',
    'example.emptyCount': 'Geben Sie eine Anzahl ein, um die Pluralform zu sehen.',
    'example.project': 'Projekt'
  }),
  // French belongs to this application. Missing built-in keys, such as table.empty,
  // fall back to English; do not spread English messages into a partial translation.
  'fr-FR': Object.freeze({
    'select.none': 'Aucune sélection',
    'select.empty': 'Aucun résultat',
    'select.toggle': 'Afficher les options',
    'select.clear': 'Effacer la sélection',
    'select.loading': 'Chargement',
    'example.preview': 'Aperçu',
    'example.welcome': 'Bienvenue, %1 !',
    'example.assigned': '%person% travaille sur %record%.',
    'example.results.one': '%1 résultat',
    'example.results.other': '%1 résultats',
    'example.emptyCount': 'Saisissez un nombre pour voir sa forme plurielle.',
    'example.project': 'Projet'
  })
});

/** The picker names supported languages; it does not supply their translations. */
export const languages = Object.freeze([
  { code: 'en-GB', description: 'English · shipped catalogue' },
  { code: 'de-DE', description: 'German · shipped catalogue' },
  { code: 'fr-FR', description: 'French · custom catalogue' }
]);
