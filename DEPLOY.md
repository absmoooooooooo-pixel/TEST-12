# Deployment

The project has a static website and an **optional** API:

| Part | What it is | Where it runs |
| --- | --- | --- |
| Website | static files: `index.html` at the repository root + `frontend/`, including a generated local calculation engine | GitHub Pages (or any static host) |
| API | `backend/` — the source formulas, densities, validation | a Node host, only if remote mode is wanted |

Nothing on the website needs a local development server or an API: the home page
is `index.html` in the repository root, so a static host serves it as `/`
automatically, and every calculator computes locally (offline after first
visit).

---

## 1. Website on GitHub Pages

1. Push the repository to GitHub (the root `index.html` is what visitors see).
2. Repository → **Settings → Pages**.
3. **Source**: *Deploy from a branch*; **Branch**: `main` (or your default
   branch), **Folder**: `/ (root)`. Save.
4. After the first build the site is at `https://<user>.github.io/<repo>/`
   (or at your custom domain). The home page opens directly; there is no
   folder listing and no backend page.

The `.nojekyll` file at the root makes GitHub Pages serve the files exactly as
they are.

All links are relative, so the same files work at a domain root
(`https://example.com/`) and in a repository sub-path
(`https://user.github.io/repo/`):

```
/index.html                      home page (calculator cards)
/frontend/about/index.html       about page
/frontend/calculators/plate/     one folder per calculator
/frontend/assets/, /frontend/shared/, /frontend/icons/
/manifest.webmanifest, /service-worker.js, /robots.txt, /sitemap.xml, /ads.txt
```

## 2. API on a Node host (optional)

**Skip this section** for a normal static deployment. It is only needed when a
deployment wants calculations to be logged or validated by a central service.

The API has no npm dependencies. Any Node 18+ host works (Render, Railway,
Fly.io, a VPS, a shared Node plan).

1. Deploy the `backend/` folder (only that folder is needed at runtime).
2. Set the environment variables:

   | Variable | Value for a split deployment |
   | --- | --- |
   | `PORT` | supplied by the host |
   | `HOST` | `0.0.0.0` |
   | `NODE_ENV` | `production` |
   | `PUBLIC_API_BASE` | `https://api.example.com` |
   | `ALLOWED_ORIGINS` | `https://<user>.github.io,https://example.com` |
   | `API_KEY` | leave empty (see below) |
   | `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS` | `120` / `60000` |
   | `MAX_BODY_BYTES` | `16384` |

3. Start it with `npm start` (or `node server.js`).
4. Check `GET https://api.example.com/api/health` returns `{"ok":true,…}`.

`ALLOWED_ORIGINS` must list the exact origin of the site: GitHub Pages sends
`https://<user>.github.io` even when the site lives in `/repo/`. Requests from
any other origin get `403`.

`API_KEY` stays empty for the public website: a static page cannot keep a
secret. Use it only for non-browser clients.

## 3. Enable remote calculation (optional)

Leave `frontend/assets/js/api-config.js` untouched for the default local-first
site. Calculators use `frontend/assets/js/calc-engine.js` and make no API
request.

To opt into the API, set both values in `api-config.js` before `calc-api.js`
loads:

```js
window.MW_API_BASE = "https://api.example.com";
window.MW_API_MODE = "remote";   // or window.MW_API_FORCE_REMOTE = true
```

Commit and push; GitHub Pages publishes it. Every calculator then tries
`POST /api/calculate/<calculator>` on that host, with a local fallback if the
host is slow or down. No key, token or secret belongs in any frontend file.

If `MW_API_BASE` is left empty in remote mode, requests go to the site's own
origin, which only works when one host serves both the pages and the API.

## What is never published

- `backend/` is not part of the website. The static host serves it as plain
  repository files only if it is inside the published folder, and the API host
  runs it as a service. The API process itself serves nothing but `/api/*`.
- `backend/.env` is git-ignored; only `.env.example` is committed.
- The source formulas, densities and validation live in `backend/calculations`,
  `backend/materials` and `backend/core`. The static site carries a generated
  mirror (`frontend/assets/js/calc-engine.js`) so calculations work offline.

## After deploying

1. `https://<site>/` shows the home page with 24 calculator cards.
2. A card opens its calculator, the drawing and layout are intact.
3. Calculate returns a result with no network request. Network tools should show
   no `/api/calculate` call, no third-party host and no language dictionary for
   English visitors. In remote mode, the `POST /api/calculate/…` returns `200`.
4. `cd backend && npm test` passes: `calculator/scenario pairs compared: 71`
   followed by `PASS`.

## Updating

- Website: push the changed files; GitHub Pages rebuilds automatically.
- API: redeploy `backend/` and restart the process.

The service worker caches the site, so a static push alone is not enough for a
cache refresh:

1. Bump `CACHE_NAME` in `service-worker.js` (for example `mw-static-v52` →
   `mw-static-v53`).
2. If pages, the translator or dictionaries changed, bump `RUNTIME_VERSION` in
   `tools/build_i18n.py`, then run `python tools/build_i18n.py`.
3. If `input-localization.js` or `numeric-keypad.js` changed, bump their `?v=`
   query strings in all 24 calculator pages and in the service worker precache
   list, then push those files together.
4. If a backend formula changed, run `python tools/build_calc_engine.py` and
   commit the regenerated engine.
5. Push everything together. On the next online visit the worker installs the
   new cache, deletes the old one and serves the updated files; previously
   visited calculators keep working offline throughout.
