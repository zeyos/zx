# WP84 — Site navigation: icons on the deployed site, and "Showcase"

Branch: `wp/84-site-nav-showcase`, from `main`. AGENTS.md applies.

Maintainer report: the icons in the header navigation do not show on the website, and the
"Layouts" entry should be called "Showcase".

Cause of the missing icons: each glyph is chosen with an `href` prefix selector
(`.site-nav a[href^="docs"]`). `tools/build-site.js` rewrites the links to clean root URLs
(`/docs`, `/layouts`, `/theme`), so on the deployed site no rule matches, `--site-nav-icon` stays
unset, and the masked `::before` paints as a filled square. From source the links are still
`docs.html`, which is why it only fails after the build.

## Items and required result

| ID | Scope | Required result |
| --- | --- | --- |
| N1 | Site chrome | Each primary-nav link names its glyph with an attribute the build leaves alone (`data-nav="docs" \| "showcase" \| "theme"`), and `site.css` selects on that attribute, never on `href`. The icons show from source (`npm run serve`) and from the built site (`npm run build:site`, `npm run serve:site`), in both themes, on every page with the header. A link without a known `data-nav` shows no empty mask box. |
| N2 | Site chrome | The "Layouts" header entry reads "Showcase" on every page. The gallery page's `<title>`, its `h1`, the single-layout page's title and bar, `layout-host.js`'s title constant, and the documentation search's path label read "Showcase". URLs stay as they are (`layouts.html`, `layout.html#<id>`, `/layouts`) so existing links, `llms.txt`, and the agent docs keep working. The word "layout" stays where it names the concept (a layout, the layout gallery's modules, `website/layouts/`), and the home page's link text pointing at the gallery says Showcase. |
| N3 | Checks | `tests/unit/layout-gallery.test.js` asserts the new label and the `data-nav` attribute on every page header, and that `site.css` has an icon rule for every `data-nav` value used. `tools/run-smoke.js` expects the new title. `tools/check-site.js` fails if a built page's `.site-nav` link lacks `data-nav`. |

## File scope

- This specification.
- `website/index.html`, `website/docs.html`, `website/layouts.html`, `website/layout.html`,
  `website/theme.html`, `website/site.css`, `website/site.js` (comment only),
  `website/layout-host.js`, `website/layouts.js` (the heading), `website/docs.js` (the search path
  label and its comment).
- `tests/unit/layout-gallery.test.js`, `tools/run-smoke.js` (the expected title),
  `tools/check-site.js`.

## Validation

`npm test`; `npm run build:site && node tools/check-site.js`; the header in light and dark from
source and from `site/`, desktop and phone width (the phone header collapses the nav).

## Out of scope

Renaming files or URLs, redesigning the header, new icons beyond the existing three SVGs in
`website/assets/`.
