/*
 * The layout gallery's registry. Each id is the basename of `<id>.layout.js` in this directory,
 * listed in gallery order. The documentation search and `tools/check-site.js` read the same lists.
 */

/** Complete applications: navigation, lists, records, and editors working together. */
const TEMPLATE_IDS = [
  'mail', 'issue-tracker', 'wiki', 'ai-chat', 'agent-workspace', 'invoice-editor',
  'item-inventory', 'workflows', 'infrastructure', 'crm'
];

/** Single screens that recur inside every application. */
const PATTERN_IDS = [
  'master-detail', 'record-collection', 'dashboard', 'inbox', 'record-page', 'agent-chat',
  'record-wizard', 'checkout-wizard', 'settings-workspace', 'system-states', 'zeyos-invoices'
];

/** Every layout, templates first. */
const LAYOUT_IDS = [...TEMPLATE_IDS, ...PATTERN_IDS];

export { LAYOUT_IDS, PATTERN_IDS, TEMPLATE_IDS };
