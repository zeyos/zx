import { en } from './en.js';
import { de } from './de.js';

export { en, de };

/** Shipped locale catalogues. Import this manifest explicitly; the main entry point stays English-only. */
export const locales = Object.freeze({ en, de });
