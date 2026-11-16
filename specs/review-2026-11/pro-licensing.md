# A Pro offer for Xenon

Not legal advice. The last section lists what a lawyer has to review before anything is sold.

## The constraint that shapes everything

`@zeyos/zx` 5.7.1 and its 19 predecessors are MIT, and stay MIT forever: anyone may use them
commercially and fork them. A new licence can only apply to *future* code that ZeyOS owns. So
"commercial users must pay" can mean one of two things:

1. **They pay for something new** (open core) — the library stays MIT; Pro is additional value.
2. **They pay to use future versions of the library itself** (relicensing from 6.0) — and 5.7.x is
   the free fork they can stay on.

Moving an existing MIT feature into Pro invites exactly that fork. Rule: nothing ever moves from
free to Pro.

## How comparable products do it

| Product | Free | Paid | Enforcement |
| --- | --- | --- | --- |
| MUI | Core MIT | X Pro $299 / Premium $599 / Enterprise $1,399 per dev per year | Offline key; watermark + console warning when invalid; expired key keeps working for versions released in term |
| AG Grid | Community MIT | Enterprise from $999 per dev, perpetual + 1 year updates | Key; watermark + console error |
| Kendo UI | 50+ free components | $799–1,299 per dev per year | Key file; watermark on premium components |
| Syncfusion | Community licence: < $1M revenue, ≤ 5 developers, ≤ 10 staff, limited outside funding | $959–1,199 per dev per year, min. 5 | Key registration |
| PrimeVue 5 (Jul 2026) | MIT up to 4.5; from 5.0 the PrimeUI licence, whose Community tier has its own developer, staff, funding and organisation limits (stricter on developers than Syncfusion's; check the current agreement) | Per dev perpetual + 1 year updates; price unpublished | Key verified offline, no telemetry; licence notice without a key |
| Handsontable | MIT ≤ 6.2.2; proprietary since 7.0 | Quote | Offline date check; blocking modal without a key |
| Tailwind Plus | — | $299 personal / $979 team, one-time | None (copy-paste) |
| affectUI | 74 items MIT | $249 individual / $699 team, one-time | Token-gated registry |
| Arc UI | 121 components MIT | $149/yr or $249 lifetime; team $449/yr or $799 | Token-gated registry |

## Options

| | A. Open core | B. Dual AGPL + commercial (6.0+) | C. Source-available above a threshold (6.0+) |
| --- | --- | --- | --- |
| How | `@zeyos/zx` stays MIT; new `@zeyos/zx-pro` under a commercial EULA | AGPL for everyone, commercial licence for proprietary use | PolyForm Small Business or a custom licence: free below ~100 people / $1M revenue, paid above |
| For | No relicensing, no fork, keeps trust; proven (MUI, AG Grid) | Monetises the whole library | Small teams free, large ones pay; PrimeVue and Syncfusion precedent |
| Against | Pro value must be built | AGPL in browser code is vetoed by legal departments; 5.7 forked | Not open source: licence scanners flag it, procurement friction for ZeyOS's own customers; 5.7 forked |

**Recommendation: A, staged.** It is the only option that does not trade adoption for revenue, and
Xenon's buyers are B2B and ERP teams and ZeyOS partners, who buy support, templates and assurance
more readily than a key-gated component.

- **Stage 0 — validate demand.** Interview five partner and customer teams before building any
  Pro product: what they would pay for, how they buy (per developer, per project, through ZeyOS
  contracts), and what procurement needs. Build only what at least two of them would buy.
- **Stage 1 — weeks, no licence code.** One-time assets that do not exist yet: new full
  application templates beyond the public Showcase, a Figma kit, a theme-builder export, delivered
  by authenticated download from a private repository. Never move a Showcase layout into it.
  Recurring obligations — priority support, an LTS branch, an accessibility conformance report
  (VPAT / EN 301 549) — are sold separately as a subscription, because they cost every year.
- **Stage 2 — when one item shows pull.** `@zeyos/zx-pro`, key-gated as below. Candidates:
  advanced charts (financial, heatmap, sankey, in-cell sparklines), scheduler / Gantt, spreadsheet
  range selection with clipboard and fill handle, grouping with aggregates, pivot, XLSX / PDF
  export, an MCP Apps host frame, Surface catalogue packs for vertical domains.
- **Keep MIT:** every current component, basic charts (WP88), the agent primitives and protocol,
  the A2UI importer, the MCP Apps view, the MCP server, theming, accessibility, localisation, and
  every bug and security fix. They drive adoption, and adoption is what Pro sells into.
- **Relicensing (C) is a strategic decision, not a fallback.** Poor Pro conversion alone is no
  reason for it: it would mostly show that Pro lacks value. Consider C for a 6.0 only if the
  interviews show that commercial users would pay for the core itself, and knowing 5.7.x stays free.

Whether Xenon earns more as a product or as a funnel into ZeyOS is an open question this review
cannot settle; Stage 0 is how to find out.

## Pricing sketch (EUR, excluding VAT)

| Tier | Price | Benchmark |
| --- | --- | --- |
| Templates + Figma (Stage 1) | €249 personal / €799 team (≤ 25), one-time, 12 months of updates | Tailwind Plus, affectUI, Arc |
| Pro (Stage 2) | €349 per developer perpetual + 12 months of updates, renewal 50 % (or €249 per developer per year) | MUI Pro, Bryntum, AG Grid |
| Premium (adds Gantt, pivot, XLSX) | €699 per developer perpetual | MUI Premium |
| Enterprise | from €1,500 per developer per year, min. 10 seats: SLA, LTS backports, conformance report, OEM rights | MUI Enterprise, Kendo |

Count concurrent front-end developers (MUI's wording); per-end-user pricing is hard to audit. A free
Community Pro licence (below the Syncfusion thresholds, plus open source and education) is worth
adding once there is revenue to protect — not before, because it adds legal work.

## Enforcement that fits a dependency-free library

- No licence code in the MIT package. `@zeyos/zx-pro` carries `pro/license.js`.
- Key `ZXP1.<base64url payload>.<base64url signature>`; payload
  `{kid, lid, org, plan, seats, features, issued, updatesUntil, expires?, hosts?}`.
- **ECDSA P-256 / SHA-256** via WebCrypto (works across the 2023+ baseline; Ed25519 is too recent).
  Several public keys by `kid` for rotation. Verified once, asynchronously, cached; components never
  wait and nothing ever throws.
- Perpetual keys compare `updatesUntil` with a build date compiled into each Pro release, so no
  client clock is trusted. `expires` drives notices only.
- `crypto.subtle` exists only in secure contexts; on a plain-HTTP intranet the status is
  "unverifiable" and the library stays silent.
- Optional host lock for OEM and SaaS keys; localhost, `127.0.0.1`, `*.localhost`, `*.test` always
  exempt; a mismatch only warns.
- Development: one `console.info` with a link, and a small "Unlicensed" badge on Pro components.
  Production: at most one `console.warn`. **No watermark, no feature lock, no network request, no
  telemetry** — GDPR-friendly, and it never breaks a customer's production application.
- API: `setLicenseKey()` (before or after mounting), `licenseStatus()`, a `zx-license` event.
- The key is public by design; the protection is the EULA's anti-circumvention clause (Elastic
  License 2.0 wording is a good model). Keys minted by an offline CLI with the signing key in a KMS.
- Delivery on public npm with `"license": "SEE LICENSE IN LICENSE"`, which keeps customers' CI
  simple; templates and Figma by authenticated download.

## For the lawyer

- Copyright ownership: an assignment or employment clause that gives ZeyOS the author's rights.
- The Pro EULA under German standard-terms law (AGB, §§ 305 ff. BGB): liability caps (intent and
  gross negligence cannot be excluded), warranty, the definition of "developer", the perpetual
  fallback, withdrawal rights for consumers.
- A CLA with a relicensing grant before accepting outside contributions to anything that may become
  Pro (a DCO is not enough).
- OEM and SaaS rights; enforceability of the anti-circumvention clause.
- **Trademark clearance for "Xenon"** — a crowded name; GitHub's Monaspace family already has a font
  called Xenon.
- EU VAT one-stop-shop for digital sales; third-party notices (Lucide, OFL fonts) in both packages.
