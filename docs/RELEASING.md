# Releasing and deploying

Two things ship from this repository, on two different triggers:

| What | Trigger | Config | Result |
| --- | --- | --- | --- |
| Documentation site | every push to `main` | `pages.yml` **or** `netlify.toml` | <https://zx.zeyos.com> |
| npm package | publishing a GitHub Release | `.github/workflows/publish.yml` | `@zeyos/zx` on npm |

`.github/workflows/ci.yml` runs the tests, both builds, and the site check on every push and pull
request, so neither of the above is the first place a problem shows up.

Both hosting options are wired up; **pick one** and delete the other, or the domain will be
claimed twice. The build output is identical either way.

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
the repository secret `NPM_TOKEN` (Settings → Secrets and variables → Actions). This mirrors the
`zeyos/client` setup, so the same token works if it is scoped to the whole organisation.

## Cutting a release

The publish workflow refuses to run if the tag and the package version disagree, so bump first:

```sh
npm version 2.0.0-alpha.1 -m "release: %s"
git push --follow-tags
```

Then create a GitHub Release for the new tag. Publishing it starts `publish.yml`, which
re-verifies the version, runs the tests, builds `dist/`, and publishes.

`prepublishOnly` runs the tests and the build for local `npm publish` too, so a manual publish
cannot ship a stale or failing `dist/`.

### Pre-releases

While the version carries a pre-release suffix (`-alpha.n`), npm marks the release `latest` unless
told otherwise. For an alpha you usually do not want that:

```sh
npm publish --tag next
```

To keep that behaviour in CI, add `--tag next` to the publish step for as long as the package is
pre-1.0-stable.

## What gets published

`files` in `package.json` limits the tarball to `dist/`, the two agent-facing documents, the
README, the migration guide, and the licence. The source modules, the website, the demos, and the
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
