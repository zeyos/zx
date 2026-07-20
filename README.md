# Zx

Zx is the dependency-free, vanilla-JavaScript component library for the ZeyOS ERP. It replaces
the MooTools-based `gx` libraries with ES2022 modules, accessible native controls, semantic design
tokens, and lifecycle-safe components. Source modules run directly in a browser; the distribution
also provides ESM and classic-script bundles.

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
| `h()`, `icon()` | Safe DOM and named-SVG factories used by applications and custom renderers. |

The public core also includes HTTP helpers, i18n, date formatting/parsing, positioning, keyboard
helpers, and small dependency-free utilities; see the named exports in `src/index.js`.

### Inputs

| API | Description |
| --- | --- |
| `button()`, `buttonGroup()` | Styled native button and grouped-button factories. |
| `CheckButton` | Two-state pressed button with optional state-specific labels. |
| `Toggle` | Native-button switch with a separate submitted value. |
| `Search` | Search input with debounced input, submit, and clear events. |
| `Select` | APG combobox with local or async filtering and a priority preset. |
| `Checklist` | Searchable checkbox group with optional async loading. |
| `DatePicker` | APG calendar grid with bounds, week numbers, and optional time selection. |
| `MonthPicker` | Twelve-month grid with year navigation. |
| `TimePicker` | Segmented local-time picker. |
| `Datebox`, `DateTimeBox` | Formatted date input and its date-time factory variant. |
| `Timebox` | Segmented signed or unsigned duration input. |

### Overlays

| API | Description |
| --- | --- |
| `Message` | Inline messages, floating toasts, and progress status. |
| `Modal` | Minimal native-dialog overlay with light-dismiss support. |
| `Dialog` | Titled modal with buttons, named views, alert, confirm, and prompt helpers. |
| `Dropdown` | Generic anchored popover with placement fallback. |
| `MenuButton` | APG menu button built on `Dropdown`. |

### Data

| API | Description |
| --- | --- |
| `Table` | Semantic sortable table with local/server sorting and row selection. |
| `DataFilter` | Declarative select, text, and custom filters for client-side row sets. |

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
| `Tabbox` | APG tabs with lazy content, closing, badges, and disabled states. |
| `NavigationBar` | Responsive application navigation with optional tab panels and overflow. |

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

Open <http://127.0.0.1:8321/demos/> for the component catalog,
<http://127.0.0.1:8321/tests/smoke/smoke.html> for source-module smoke tests, or build first and
open <http://127.0.0.1:8321/tests/smoke/smoke-dist.html> for classic-script distribution tests.

```sh
npm test       # Node unit tests plus semantic-token lint
npm run build  # writes ESM, global, compatibility, and CSS assets to dist/
```

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
