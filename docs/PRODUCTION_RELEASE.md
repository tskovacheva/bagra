# Bagra — production release runbook

For the maintainer. Spec §13ga is the reasoning; this is the procedure.

**Production:** `https://bagra.crafty.place` — Cloudflare Pages project `bagra`, Direct Upload.
**Staging:** Cloudflare Pages project `bagra-staging`, its own `*.pages.dev` origin. Never the same origin as production.
**Rule above all others: never downgrade a user's database.** No release lowers `DB_VERSION`; no recovery restores an older one.

## 1. Prerequisites (once)

- Source repository **private**. Production is never built from, or served out of, the repository.
- Cloudflare account; two Pages projects created as **Direct Upload** (not Git-connected): `bagra`, `bagra-staging`.
- `bagra.crafty.place` attached to `bagra` as a custom domain; DNS at the registrar's host (Wix today):
  `CNAME bagra → bagra.pages.dev`. Wait for the certificate to be active before anything else.
- `npm i -g wrangler` (or use `npx wrangler`), `wrangler login`.

## 2. Build and gate

```sh
sh check.sh --release          # must end EXIT 0; it also builds and checks dist/
node scripts/make-release.mjs  # rebuild dist/ from the final tree (deterministic)
node scripts/try-production.mjs
```

The version is in `version.js`; `sw.js` CACHE and the CHANGELOG's newest entry must say the same (the gate checks).

## 3. Staging

```sh
npx wrangler pages deploy dist --project-name bagra-staging --branch main
```

Only ever `dist`. The command names the directory; there is no setting that could make it upload the repository.

## 4. Staging smoke test (on a phone and on a laptop)

1. HTTPS, padlock, no warnings. 2. The app loads; the sidebar shows the new version.
3. `manifest.json` loads; the browser offers to install. 4. DevTools/Application (laptop): a worker active for the origin.
5. Reload. 6. Offline (airplane mode / DevTools offline): close, reopen — it starts.
7. A fresh profile: an empty database seeds sixteen recipes and 57 plants.
8. An existing staging install: „Обнови" appears, pressing it reloads into the new version, the data is there.
9. Backup → download; open the file; counts match. 10. Restore it (replace) into a fresh profile.
11. Switch BG ↔ EN. 12. Write one trial and one cloth; close; reopen; both there.
13. Backup screen → „Провери за нова версия" answers.

## 5. Production

```sh
npx wrangler pages deploy dist --project-name bagra --branch main
```

The **same `dist/`** that passed staging — not a rebuild. A Pages deployment switches atomically; even if a host
served a half-updated set, the worker's install is all-or-nothing and the old release stays (Package 2, U3).

## 6. Production smoke test

Steps 1, 2, 3, 5, 6, 8 and 13 of §4, on `https://bagra.crafty.place`, on one phone and one laptop that already
have Bagra installed. Then confirm `https://bagra.crafty.place/version.js` shows the new version.

## 7. When a release is bad

| Case | What happened | Do |
|---|---|---|
| A | Bad code, `DB_VERSION` unchanged | Take the last good tree, give it the **next** rc number, gate, staging, production. Clients see it as an update. |
| B | Bad code, `DB_VERSION` raised | **Fix forward only**, on the new schema. Older code cannot open the upgraded database. |
| C | Broken deployment (missing files, wrong headers), same version | Cloudflare **rollback** to the previous deployment *of the same version*, or redeploy the same `dist/`. Installed copies are unaffected: their install of a broken set failed and they kept the old release. |
| D | Broken `sw.js` | If it does not parse, no client installs it — publish a fixed release (next rc). If it parses but misbehaves, the fix is still a new release: `sw.js` is served `no-cache` and registered with `updateViaCache: 'none'`, so every client checks it on its next start. |

**Cloudflare „rollback" is an infrastructure tool, not a Bagra release.** Rolling back to a deployment with an
*older* version publishes a `sw.js` that installed clients already have or have passed: it reaches nobody who
updated, and serves the old code to everybody new. Use it only for case C. For A, B and D: forward, with a new number.

## 8. After every production release

- Uptime check on `https://bagra.crafty.place/` (any external monitor; alert by e-mail). Optionally a keyword check
  that `/version.js` contains the version just released.
- Tag the source commit with the version. Keep the `dist/` folder of every release that reached production
  (zip it beside the tag): it is the known-good artifact for case C and the base for case A.
