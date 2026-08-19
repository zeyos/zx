# Releasing and deploying

Two things ship from this repository, on two different triggers:

| What | Trigger | Config | Result |
| --- | --- | --- | --- |
| Documentation site | every push to `main` | `pages.yml` **or** `netlify.toml` | <https://zx.zeyos.com> |
| npm package | publishing a GitHub Release | `.github/workflows/publish.yml` | `@zeyos/zx` on npm |

`.github/workflows/ci.yml` runs the tests, both builds, and the site check on every push and pull
request, so neither of the above is the first place a problem shows up.

**Netlify is the host.** It builds `site/` on every push to `main` and zx.zeyos.com is serving the
new build within about a minute. `pages.yml` is parked on `workflow_dispatch` as a fallback, so it
never runs on its own and cannot claim the domain a second time; delete it if GitHub Pages is
ruled out for good. The build output is identical either way.

## One-time setup

### 1. The repository

The package name, `homepage`, and the site's own links assume `github.com/zeyos/zx`. Change
`repository.url`, `bugs.url`, and `homepage` in `package.json` — and the three `href`s in
`website/*.html` — if it lands somewhere else.

```sh
git remote add origin git@github.com:zeyos/zx.git
git push -u origin main
```

### 2a. Hosting on Netlify

Netlify is the lower-friction option: it manages the certificate, and it builds every pull
request into a preview URL.

Point it at this repository and let `netlify.toml` do the rest — it already sets

```toml
[build]
  command = "npm run build:site && node tools/check-site.js"
  publish = "site"
```

**The publish directory must be `site/`, not `website/`.** The website is developed in place and
reaches above itself (`../styles/zx.css`, `../../src/index.js`, `../docs/llms.md`), so publishing
`website/` returns `docs.html` with a 404 for the stylesheet and for the whole library — an
unstyled, inert page. The build step is what makes the tree self-contained.

Then add `zx.zeyos.com` under *Domain management* and create the DNS record Netlify shows, which
is normally:

```
zx    CNAME    <site-name>.netlify.app.
```

If you take this route, delete `.github/workflows/pages.yml`; the `CNAME` file the build writes is
ignored by Netlify and does no harm.

### 2b. Hosting on GitHub Pages

In **Settings → Pages**, set *Source* to **GitHub Actions** (not "Deploy from a branch"). The
workflow uploads the `site/` artifact and deploys it; no `gh-pages` branch is involved.

Then set the custom domain to `zx.zeyos.com` and tick *Enforce HTTPS* once the certificate is
issued. `tools/build-site.js` writes the `CNAME` file into every build, so the domain survives
redeploys — do not rely on the setting alone.

The DNS record is:

```
zx    CNAME    zeyos.github.io.
```

(Substitute the organisation that owns the repository. An apex domain would need A/AAAA records
instead, but a subdomain always uses `CNAME`.) Certificate issuance usually takes a few minutes
and can take up to an hour.

If you take this route, delete `netlify.toml`.

### 3. npm

The package is scoped: `zx` is taken on npm by an unrelated project, so it publishes as
`@zeyos/zx` with `publishConfig.access: public`.

Create an **automation** token on npm with publish rights to the `@zeyos` scope, then add it as
the repository secret `NPM_TOKEN` (Settings → Secrets and variables → Actions).

> **Publishing this package needs a granular token with _bypass 2FA_ enabled.** This has already
> cost three release attempts, and the two failures report it differently, which is why both are
> written down here.
>
> From CI, with the current `NPM_TOKEN`:
>
> ```
> npm error 404 Not Found - PUT https://registry.npmjs.org/@zeyos%2fzx
> ```
>
> From an interactive `npm login` session, as an owner of the `zeyos` organisation:
>
> ```
> npm error 403 Forbidden - PUT https://registry.npmjs.org/@zeyos%2fzx
> npm error 403 Two-factor authentication or granular access token with bypass 2fa enabled
> npm error 403 is required to publish packages.
> ```
>
> The 403 is the one that names the cause: the organisation enforces two-factor authentication for
> publishing. A plain login session has to supply a one-time code, and an automation token has to
> be the kind that is allowed to skip it. The 404 is the same wall seen through a token that also
> cannot see the package it is being asked to create — npm answers that with 404 rather than 403,
> which reads exactly like a typo in the package name. Neither message points at 2FA.
>
> The scope itself has never been the problem: `@zeyos/client` publishes from this organisation.
>
> Two ways through:
>
> - **For CI, and every release after it** — create a granular access token with **bypass 2FA**
>   turned on, write access to the `@zeyos` organisation, and permission to create new packages;
>   put it in the `NPM_TOKEN` secret. This is the one to do, because it fixes every future release
>   as well as this one.
> - **By hand, once** — `npm publish --access public --otp=<code>` from a logged-in shell, which
>   creates the package. Every later release still needs the token above, so this only buys time.
>
> Verify with `npm view @zeyos/zx version` before cutting a release that depends on it.

## Cutting a release

First move `CHANGELOG.md`'s `## Unreleased` heading to the version and date being cut, and open a
fresh `## Unreleased` above it. The file ships in the tarball, so an entry that still says
"Unreleased" is published as such.

The publish workflow refuses to run if the tag and the package version disagree, so bump next:

```sh
npm version 2.0.0 -m "release: %s"
git push --follow-tags
```

Then create a GitHub Release for the new tag. Publishing it starts `publish.yml`, which
re-verifies the version, runs the tests, builds `dist/`, and publishes.

A **draft** release does not start anything — the workflow triggers on `release: published` — so a
release can be staged with its notes ready and completed with one click once npm is in order.

`prepublishOnly` runs the tests and the build for local `npm publish` too, so a manual publish
cannot ship a stale or failing `dist/`.

### Pre-releases

While the version carries a pre-release suffix (`-alpha.n`), npm marks the release `latest` unless
told otherwise. For an alpha you usually do not want that:

```sh
npm publish --tag next
```

`publish.yml` already does this: it reads the version and publishes any semver pre-release under
`next`, and only a stable version under `latest`. Nothing to remember at release time — but a
**manual** publish still needs the flag, because `npm publish` on its own always writes `latest`.

## What gets published

`files` in `package.json` limits the tarball to `dist/`, the three agent-facing documents
(`llms.md`, `llms.txt`, `api.json`), the README, the changelog, the migration guide, and the
licence. The source modules, the website, the demos, and the
tests stay out of it — consumers get the built bundles:

| Entry point | Import |
| --- | --- |
| Components | `import { Table } from '@zeyos/zx'` |
| Styles | `import '@zeyos/zx/zx.css'` |
| ZeyOS binding | `import { zeyosTable } from '@zeyos/zx/zeyos'` |
| gx compatibility | `import { gx } from '@zeyos/zx/compat'` |
| Global bundles | `@zeyos/zx/global`, `@zeyos/zx/compat-global` |

Publishing to npm also makes the CDN copies work without any extra step:
`https://cdn.jsdelivr.net/npm/@zeyos/zx/dist/zx.esm.js`.

## The site build

`npm run build:site` assembles `site/` and `node tools/check-site.js` verifies it.

The website is developed in place — `website/docs.html` loads `../styles/zx.css`, the demos import
`../../src/index.js` — which keeps development build-free but means `website/` cannot be served on
its own. The build flattens one level: `website/` becomes the site root and the directories it
reaches into (`src/`, `styles/`, `docs/`, the repository markdown) are copied in beside it, with
every escaping path losing exactly one `../`.

Nothing is bundled or minified, so the **JavaScript** tab keeps showing the same source the
browser actually runs.

Preview the deployable output exactly as it will be served:

```sh
npm run build:site && npm run serve:site
```

The output is host-neutral. It contains no dot-directories (the agent skill is republished as
`skills/`), a `CNAME` file that only GitHub Pages reads, and a `.nojekyll` marker that only
GitHub Pages needs — both inert everywhere else.
