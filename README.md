# Zx

Zx is the dependency-free, vanilla-JavaScript component library for ZeyOS business applications:
ES2022 modules, accessible native controls, semantic design tokens, and lifecycle-safe components.
Source modules run directly in a browser; the distribution also provides ESM and classic-script
bundles. An opt-in compatibility layer keeps existing MooTools-era `gx` code running while it is
modernised.

## Quick start

Use the ESM bundle when the application already uses modules:

```html
<link rel="stylesheet" href="/assets/zx.css">
<div id="notifications"></div>

<script type="module">
  import { Toggle } from '/assets/zx.esm.js';

  const toggle = new Toggle(null, {
    label: 'Notifications',
    value: 'enabled',
    onchange: (event) => console.log(event.detail.checked)
  });
  document.querySelector('#notifications').append(toggle.toElement());
</script>
```

For an application built from classic scripts, the IIFE bundle exposes the same API as
`window.zx`:

```html
<link rel="stylesheet" href="/assets/zx.css">
<script src="/assets/zx.global.js"></script>
<script>
  const toggle = new zx.Toggle(null, { label: 'Notifications' });
  document.body.append(toggle.toElement());
</script>
```

Components accept an existing element or selector as their first argument. Passing `null` makes
the component create and own its root. Call `destroy()` when a component is no longer needed; an
owned root is removed, while an enhanced target is restored.

## Component index

The groups match the demo sidebar.

### Core

| API | Description |
| --- | --- |
| `Component` | Lifecycle, event, element-registry, and cleanup base class. |
| `defineElements()` | Registers the light-DOM `<zx-*>` wrappers for the supported declarative components. |
| `h()`, `icon()` | Safe DOM and icon factories used by applications and custom renderers. |
| `loadFontAwesome()` | Opts the icon layer into a Font Awesome kit; `useBuiltinIcons()` switches back. |
| `onBreakpoint()` | Named width bands, observed on an element or the window. |

The public core also includes HTTP helpers, i18n, date formatting/parsing, positioning, keyboard
helpers, and small dependency-free utilities; see the named exports in `src/index.js`. Alongside
them are locale-aware formatters (`formatNumber`, `formatCurrency`, `formatPercent`,
`formatFileSize`, `formatRelativeTime`), collection helpers (`groupBy`, `sortBy`, `uniqueBy`),
`throttle` beside `debounce`, `escapeRegExp` and `highlightMatch` for filtering lists, a
namespaced `storage()` view that degrades to memory when the browser refuses writes, and
`toCsv`/`downloadBlob`/`copyToClipboard` for exporting what a table is showing.

`icon()` renders the inline SVG glyphs Zx bundles — no webfont, stylesheet, or network request.
Applications that want Font Awesome call `loadFontAwesome({ kit })` once, and every icon in the
library follows, including names Zx maps to their Font Awesome counterparts. Names can also pick a
renderer themselves: `'fa:user'`, `'duotone:user'`, `'kit:zeyos-notes'`, `'builtin:check'`, or a
literal `'fa-solid fa-user'` class list. ZeyOS module icons and their identity colours live in the
ZeyOS binding — see `src/zeyos/modules.js`.

### Inputs

| API | Description |
| --- | --- |
| `button()`, `buttonGroup()` | Styled native button and grouped-button factories. |
| `badge()`, `badgeGroup()` | Status-pill factories with semantic kinds, variants, and sizes. |
| `CheckButton` | Two-state pressed button with optional state-specific labels. |
| `Toggle` | Native-button switch with a separate submitted value. |
| `Search` | Search input with debounced input, submit, and clear events. |
| `Select` | APG combobox with local or async filtering and a priority preset. |
| `Checklist` | Searchable checkbox group with optional async loading. |
| `TagPicker` | Multi-select combobox that keeps its selection as removable tags. |
| `NumberField` | APG spinbutton with step buttons, ranges, units, and wrapping. |
| `Rating` | Star rating as a radio group, with optional half steps. |
| `Slider` | Range control for a bounded numeric value, with marks and an optional number box. |
| `DatePicker` | APG calendar grid with bounds, week numbers, and optional time selection. |
| `MonthPicker` | Twelve-month grid with year navigation. |
| `TimePicker` | Segmented local-time picker. |
| `Datebox`, `DateTimeBox` | Formatted date input and its date-time factory variant. |
| `DateRangePicker` | Two-month range calendar with presets, night bounds, and range preview. |
| `DateRangeBox` | Formatted date-range input with an anchored range calendar. |
| `Timebox` | Segmented signed or unsigned duration input. |
| `copyButton()` | Button that copies a string and confirms it in place. |
| `CopyInput` | Read-only box holding a value to be copied, with the copy button attached. |

### Overlays

| API | Description |
| --- | --- |
| `Message` | Inline messages, floating toasts, and progress status. |
| `Modal` | Minimal native-dialog overlay with light-dismiss support. |
| `Dialog` | Titled modal with buttons, named views, alert, confirm, and prompt helpers. |
| `Dropdown` | Generic anchored popover with placement fallback. |
| `MenuButton` | APG menu button built on `Dropdown`. |
| `ContextMenu` | APG right-click menu for a region or, via `selector`, per row. |
| `Tooltip`, `tooltip()`, `describe()` | Hover/focus description bubble anchored with `position()`. |

### Data

| API | Description |
| --- | --- |
| `Table` | Semantic sortable table with local/server sorting, row selection, and opt-in inline cell/row editing. |
| `DataFilter` | Declarative select, text, and custom filters for client-side row sets. |
| `TreeView` | APG tree with lazy children, filtering, and tri-state checkboxes. |
| `Finder` | Miller-columns hierarchy browser with an optional preview pane. |
| `Pagination` | Page, page-size, and load-more pager, with the pure `paginationRange()` helper. |

### Forms

| API | Description |
| --- | --- |
| `Permission` | Private, public, or group-level permission selector. |
| `Field` | Label, description, validation state, and adapter-backed form control. |
| `Fieldset` | Native fieldset that owns and coordinates fields. |
| `Form` | Form composition, values, validation, highlighting, and actions. |
| `ValueList` | Validated, sortable tag/chip editor. |
| `MultiValueEditor` | Ordered editable rows with add, remove, and move controls. |
| `FieldUpload` | Click/drop file upload with progress, abort, validation, and preview. |

### Layout

| API | Description |
| --- | --- |
| `Groupbox` | Collapsible section backed by native `<details>`. |
| `Panel` | Framed, optionally collapsible section with a footer. |
| `MasterPanel` | Full-height application panel with fixed header actions and footer. |
| `Tabbox` | APG tabs in four appearances, with lazy content, closing, badges, and disabled states. |
| `NavigationBar` | Responsive application navigation with optional tab panels and overflow. |
| `Toolbar` | APG toolbar: one tab stop, arrow-key movement, and overflow into a menu. |
| `SplitView` | Resizable two-pane split with a keyboard-operable separator. |
| `Stepper` | Linear multi-step progress with completed, active, and error states. |
| `Breadcrumb` | Hierarchy trail with middle-collapse, pairing with `Finder` and `TreeView`. |
| `emptyState()` | Placeholder for an empty list, table, or panel, with optional actions. |
| `stack()`, `grid()`, `aspect()` | Spacing, an intrinsically reflowing grid, and a fixed-ratio box. |
| `spinner()` | Indeterminate activity ring for a wait of unknown length. |
| `ProgressBar` | Determinate progress track, with success and error states. |
| `InlineLoading` | Status line that resolves a wait into its outcome in place. |
| `skeleton()`, `skeletonText()`, `skeletonTable()` | Placeholders shaped like the content that is coming. |
| `truncate()` | Clamps text to a number of lines, with the full value on hover. |

## Talking to ZeyOS

Use `@zeyos/client` for ZeyOS authentication, transport, generated resource operations, and runtime
schema introspection. Zx adds `zx-zeyos`, a schema-driven layer above that client: inject an existing
client into `connect`, `zeyosTable`, `zeyosForm`, or `zeyosSelect` to generate typed tables, forms,
and async entity selectors from real resource metadata.

```js
import { createZeyosClient } from '@zeyos/client';
import { zeyosForm, zeyosTable } from '/assets/zx-zeyos.esm.js';

const client = createZeyosClient({ platform, auth });
const list = zeyosTable(client, 'transactions', {
  fields: ['transactionnum', 'account', 'date', 'netamount', 'status']
});
await list.load();

const editor = zeyosForm(client, 'transactions', {
  fields: ['transactionnum', 'account', 'date', 'netamount', 'status']
});
```

The injection design means Zx never imports or bundles `@zeyos/client`. The optional binding ships
separately as `dist/zx-zeyos.esm.js` and is not part of the root `src/index.js` API. See the
schema-driven `website/layouts/zeyos-invoices.layout.js` for list, filter, sort, edit, and create wiring.

The same entry point carries ZeyOS module identity — the icon and colour of every module, keyed by
module, entity, or API resource name:

```js
import { moduleChip, moduleColor, useZeyosIcons } from '/assets/zx-zeyos.esm.js';

await useZeyosIcons();                        // loads the ZeyOS Font Awesome kit
nav.append(moduleChip('tickets', { size: 24, title: true }));
moduleColor('invoices');                      // '#535494'
```

`src/zeyos/modules.js` is the configuration file behind it: one entry per module with its kit icon
name, identity colour, label, and a stock Font Awesome fallback. The `--zx-module-*` CSS custom
properties are generated from that file, so CSS and JavaScript cannot disagree about a colour.

## Themes and density

Load `zx.css` once. Zx components consume semantic `--zx-*` tokens and inherit their values from
the document. Select a built-in theme and density on any ancestor (normally `<html>`):

```html
<html data-zx-theme="dark" data-zx-density="compact">
```

Theme values are `light`, `dark`, and `auto`; density values are `cozy` and `compact`. `auto`
follows the operating-system color preference. A product theme can override semantic tokens
without reaching into component CSS:

```css
:root[data-zx-theme="acme"] {
  --zx-color-bg-page: #f4f1eb;
  --zx-color-bg-surface: #fffdf8;
  --zx-color-bg-control: #ffffff;
  --zx-color-border-control: #978e80;
  --zx-color-text: #26221d;
  --zx-color-text-muted: #655e54;
  --zx-color-accent: #176b52;
  --zx-color-on-accent: #ffffff;
}
```

Prefer semantic tokens such as `--zx-color-*`, `--zx-control-*`, `--zx-space-*`,
`--zx-radius-*`, and `--zx-text-*`. Palette tokens are implementation details and should not be
used by application or component CSS.

## Browser support

Zx targets current evergreen Chrome, Edge, Firefox, and Safari with browser capabilities from
roughly 2023 onward. It uses native `<dialog>`, the Popover API, `:has()`, container queries,
ES2022 modules, and abortable event listeners. No transpilation or legacy-browser polyfill bundle
is provided. CSS anchor positioning is used only when supported; the library otherwise uses its
JavaScript positioning fallback.

## Development

Install the single development dependency and start the no-build demo server:

```sh
npm install
npm run serve
```

Open <http://127.0.0.1:8321/website/docs.html> for the documentation — getting started, every
component with a live demo and its JavaScript source, and the application layouts. Also available: <http://127.0.0.1:8321/tests/smoke/smoke.html> for source-module smoke
tests, or build first and open <http://127.0.0.1:8321/tests/smoke/smoke-dist.html> for
classic-script distribution tests.

```sh
npm test           # Node unit tests plus semantic-token lint
npm run build      # writes ESM, global, compatibility, and CSS assets to dist/
npm run build:site # assembles the deployable documentation site into site/
npm run serve:site # serves site/ exactly as it will be deployed
```

## Installing

```sh
npm install @zeyos/zx
```

```js
import { Table, Message } from '@zeyos/zx';
import '@zeyos/zx/zx.css';
```

Additional entry points: `@zeyos/zx/zeyos` (the schema-driven ZeyOS binding), `@zeyos/zx/compat`
(the gx compatibility namespace), and `@zeyos/zx/global` for classic script tags.

Documentation lives at <https://zx.zeyos.com>; see `docs/RELEASING.md` for how the site and the
package are published.

## `gx` compatibility layer

During an incremental migration, load the global API before the compatibility bundle:

```html
<link rel="stylesheet" href="/assets/zx.css">
<script src="/assets/zx.global.js"></script>
<script src="/assets/zx-compat.global.js"></script>
<script>
  // Only when old code relies on __(), _(), or prototype conveniences:
  gx.compat.installGlobals();
</script>
```

The compatibility bundle always exposes `window.gx` and installs only the element
`store`/`retrieve`/`eliminate` shim automatically. Legacy globals and prototype conveniences are
an explicit opt-in through `gx.compat.installGlobals()`. See [MIGRATION.md](./MIGRATION.md) for
class mappings, script replacement, deliberate behavior changes, and unsupported legacy APIs.
