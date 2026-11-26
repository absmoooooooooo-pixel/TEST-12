# Multilingual architecture & Chrome Translate audit

Scope: every language version of the Metal Weight Calculator (`en`, `mr`, `hi`, `de`, `es`,
`fr`, `ja`, `zh`, `pt`, `ar`), the shared i18n runtime, the technical-language layer, the
shared history module and the service worker.

Nothing in the visual design, the formulas, the engineering dimensions, the routing or the
English master layout was changed.

---

## 1. Root cause of "This page isn't responding"

**Confirmed by inspection and by reproducing the write pattern in a real Chrome build.**

Two independent text pipelines were writing to the same nodes:

1. **The site's own runtime** (`frontend/i18n/i18n.js`, and the generated
   `i18n-static.js`) kept a live `MutationObserver` on `document.body` with
   `childList + subtree + characterData`.
2. **Google Chrome Translate** rewrites the same text nodes and wraps each rewritten run in
   `<font style="vertical-align: inherit">`.

When Chrome Translate translated the Marathi page into English, the observer saw those
changes, reverse-mapped the English text back to its Marathi source through the dictionary
and wrote Marathi again. Measured on the real page: the `<h1>` "Plate Weight Calculator"
was put back to "प्लेट वजन कॅल्क्युलेटर" within **~1.2 s**, and 104 mutation records were
produced by that single pass. Chrome Translate then re-translated the changed text, which
produced more mutations, which produced more Marathi writes. In a real browser this is an
endless two-engine ping-pong: the main thread never idles, Chrome eventually shows
*"This page isn't responding"* with *Wait / Exit page*.

Contributing factors that made the loop fast and expensive:

- The observer was attached to the whole body and reacted to **every** text node, including
  Chrome's own `<font>` wrappers.
- It ran a digit-normalisation pass over the page on each translation pass.
- A second observer (`frontend/i18n/technical-language.js`) watched
  `documentElement + characterData` and re-wrote the MM/inch and kg/pound toggle labels, so
  it also fired on translated text and forced layout passes.
- Nothing in the code ever asked "is a page translator active?" — there was no way for the
  loop to end.

This was **not** DOM size (≈900 elements), not heavy SVG (111 labels, no canvas), not
animations, and not the number of listeners. It was two writers fighting over the same
text, with the site's writer always winning.

## 2. Files and components inspected

| Area | Files |
| --- | --- |
| i18n runtime | `frontend/i18n/i18n.js`, `frontend/i18n/i18n-static.js` (generated), `frontend/i18n/translations.js`, `frontend/i18n/number-format.js`, `frontend/i18n/language-switcher.js`, `frontend/i18n/localized-support.css` |
| Dictionaries | `frontend/i18n/*/dict-*.js` (structure only — keys `strings` / `templates` / `terms` / `units`) |
| Technical labels | `frontend/i18n/technical-language.js` |
| Shared modules that write text | `frontend/shared/calculation-history.js`, `calculator-material-grades.js`, `material-select.js`, `material-density.js`, `weight-unit.js`, `formula-unit.js`, `numeric-keypad.js`, `number-localize.js`, `input-localization.js`, `smart-install-popup.js`, `add-shortcut.js`, `feedback.js`, `pwa-install.js` |
| Boot / cache | `service-worker.js`, `tools/build_i18n.py`, `tools/build_static_languages.py`, `tools/bump_i18n_version.py` |
| Pages | the 261 versioned pages plus the 9 locale trees (`mr/`, `hi/`, `de/`, `es/`, `fr/`, `ja/`, `zh/`, `pt/`, `ar/`) |

## 3. Files modified

| File | Change |
| --- | --- |
| `frontend/i18n/i18n.js` | Translator detection (`translatorDetected`, `translatorMarkers()`, `goPassive()`); observer disconnects permanently on the first translator signal; all four `observe()` sites guarded; `shouldSkip()` and the digit pass become no-ops in passive mode; `<font>` detection in the observer callback; `switchTo()` resets the latch; new guard that never renders a translated result still containing `{placeholder}`. |
| `frontend/i18n/i18n-static.js` | Regenerated from the same source (same guards) **and** its `begin()` now applies the URL's language at `DOMContentLoaded` with no `load` handler and no 500 ms timer. |
| `frontend/assets/js/dashboard-static.js` | Regenerated (same runtime tail). |
| `frontend/i18n/technical-language.js` | `translatorBusy()` now also treats any `<font>` element as a translator signal (Chrome writes those before its banner and `html` class exist); observer narrowed from `documentElement + characterData` to `document.body + childList` and only for `svg`, the four unit-toggle ids or nodes containing `svg`/`.unit-switch`; `localizeToggle()` is idempotent (writes only when the label differs) and does nothing while a translator is active. |
| `frontend/shared/calculation-history.js` | `t()` no longer interpolates into a `null` result — a missing key used to print the literal word "null" in the history drawer. |
| `tools/build_static_languages.py` | Static boot tail: locked language applied at `DOMContentLoaded`, immediate, no fixed delay; assertion and comment updated. |
| `tools/build_i18n.py` | `RUNTIME_VERSION` 62 → 63. |
| `tools/bump_i18n_version.py` | `OLD/NEW` 62 → 63. |
| 261 pages | i18n asset URLs and `__MW_I18N_CONFIG.version` → 63. |
| 240 pages | `calculation-history.js?v=28` → `?v=29`. |
| `service-worker.js` | `CACHE_NAME` `mw-static-v133` → `mw-static-v134`. |

No `translate="no"`, `notranslate` or `.skiptranslate` was added anywhere: Google Translate
can translate every user-facing string on every page.

## 4. Architecture problems identified

1. **Two translation engines, one DOM.** Documented above. The site must never re-assert
   its language after a browser translator has taken over.
2. **Language applied too late on static pages.** `i18n-static.js` waited for `load` and
   then `setTimeout(…, 500)` before switching to the URL's language, so a Marathi page was
   an English page for up to half a second plus network time. (Server-rendered pages were
   already correct; the flash came from the calculator rewriting its own labels from English
   literals *after* that, with nothing re-translating them until the runtime woke up.)
3. **An unfilled template could surface as text.** A whole sentence matched a `templates`
   entry (e.g. `"{name} वेट कॅल्क्युलेटर"`), and the installer popup then showed literal
   braces. The runtime had no rule against returning a template it could not fill.
4. **`String(null)` in a shared module.** `calculation-history.js` built interpolated
   strings from `MW_I18N.t()`, which returns `null` for an uncovered key, so the history
   drawer displayed "null" as the summary line.
5. **Broad observers.** The technical-language observer watched the whole document with
   `characterData`, so unrelated text changes — including a translator's — triggered SVG
   re-measurement and label re-fitting.
6. **Observers that could not be stopped.** Neither observer had any notion of "someone else
   owns the text now", so behaviour could only get worse during translation.

## 5. Multilingual architecture improvements

- **Each static page is a first-class locale.** The page ships its language in the markup,
  `<html lang>`, `<html dir>` and its own dictionary; nothing waits on the English page.
- **Language is applied before first paint.** The static runtime calls
  `switchTo(lockedLanguage)` synchronously inside `DOMContentLoaded`; strings the calculator
  writes afterwards (from English literals) are translated by the observer inside the same
  task, before the frame is painted. Measured: 0 painted English frames in all nine
  non-English languages.
- **A single translator rule set.** One function decides whether a translator owns the page
  (`translated-ltr|rtl`, `.skiptranslate`, `#goog-gt-tt`, `iframe.goog-te-banner-frame`, or
  any `<font>`); once true it is latched for the page, the site's observer disconnects and
  every subsequent write and digit pass is skipped. There is no timeout, no suppression and
  no retry.
- **Templates can no longer leak.** `translateWith()` returns `null` instead of a string
  that still contains `{placeholder}`, so the caller falls back to its own text and the
  missing-translation log (`?i18nDebug=1`) records the gap.
- **Missing dynamic strings fall back safely.** The history module prints the English
  sentence rather than "null".
- **Terminology and units stay technical.** `L`, `W`, `T`, `mm`, `inch`, `kg`, `lb`,
  `g/cm³`, grades, standard numbers and formulas remain Latin and untouched; only the labels
  around them are localized (`weight-unit.js`, `formula-unit.js` and
  `calculator-material-grades.js` all return the source when no translation exists).

## 6. Language loading improvements

- Static pages: locked language applied at `DOMContentLoaded`, immediately.
- Master English pages: language switch remains in-place (`switchTo`) with no reload; the
  support stylesheet is injected/removed with the switch (verified: `supportCount` 0 → 1 → 0).
- Direct URLs, refresh and back/forward all keep the page's own language, because the
  language comes from the URL, not from storage or browser settings.
- No new network request is introduced: the dictionaries were already in the page bundle.

## 7. Chrome Translate compatibility improvements

- The site stops writing the moment a translator signals ownership (latched, one-way).
- The site never rewrites a node the translator created; `<font>` subtrees are skipped by
  `shouldSkip()`.
- The toggle initialiser no longer re-writes `MM`/`इंच`/`kg`/`पाउंड` while a translator is
  active — that was the last fight (4 nodes) and it is gone.
- The site's own language selector still works and still resets the latch, because an
  explicit language choice is a deliberate user action that starts a fresh page state.
- No second translation engine, widget or API was added.

## 8. Performance optimizations

- Observer scope: body-level `childList` instead of document-level `characterData`; the
  technical layer now reacts only to `svg`, four toggle ids, or inserted subtrees that
  contain them.
- Idempotent writes: toggle labels are only assigned when the value differs, so a pass
  cannot create its own mutation.
- Digit pass and all DOM writes are skipped in passive mode.
- Nothing was deferred or lazy-loaded: the language is still applied before paint.

## 9. Languages tested

`en` (master), `mr`, `hi`, `de`, `es`, `fr`, `ja`, `zh`, `pt`, `ar`.

## 10. Desktop and mobile results

**Desktop (1280 × 900, fresh profile per run, CDP + real Chrome):**

| Language | H1 on first painted frame | Painted English frames | Result after 1000/1000/10 |
| --- | --- | --- | --- |
| en (master) | Plate Weight Calculator | — (English page) | 78.50 kg |
| mr | प्लेट वजन कॅल्क्युलेटर | 0 | ७८.५० kg |
| hi | प्लेट वजन कैलकुलेटर | 0 | ७८.५० kg |
| de | Plattengewichtsrechner | 0 | 78,50 kg |
| es | Calculadora del peso de… | 0 | 78,50 kg |
| fr | Calculateur de poids de… | 0 | 78,50 kg |
| ja | 板重量計算ツール | 0 | ７８.５０ kg |
| zh | 板重量计算器 | 0 | 78.50 kg |
| pt | Calculadora de Peso de… | 0 | 78,50 kg |
| ar | حاسبة وزن اللوحة | 0 | ٧٨.٥٠ kg |

"Painted English frames" is counted from `requestAnimationFrame` sampling (the callback
runs immediately before paint), so a value of 0 means no frame ever showed English.

**Functional sweep (mr / hi / ar):**

- 1000 × 1000 × 10 mm → ७८.५० kg / ٧٨.٥٠ kg.
- Material changed through the real `<select>`: कार्बन स्टील → स्टेनलेस स्टील, result
  ७८.५० → ८०.०० kg.
- Inch mode: labels become लांबी (लां) / रुंदी (रुं) / जाडी (जाड), result
  १२,८६,३८४.५२ kg.
- Pound mode: १७३.०६ पाउंड (ar: ١٧٣٫٠٦ رطل).
- History drawer: eyebrow, stored summary and the record itself are all in the page
  language with native digits, e.g. "सर्व कॅल्क्युलेटरमध्ये १ गणना जतन केली." — no "null",
  no `{placeholder}` anywhere in the page text.

**Mobile (390 × 844, DPR 3, touch):** mr, hi, de, ar, ja — native `<h1>`, horizontal
overflow 0 px, UI labels 12 px with 1.65 line-height, results localized
(०.०० / ０.００ kg). The number fields are `readonly` on mobile by design (the custom numeric
keypad writes into them), so the harness could not type into them; with values applied
directly through the same `input`/`change` events the mobile calculation returns
७८.५० kg. The keypad's own tap path was not driven.

**Language switching (master page):** EN → MR → EN verified; Marathi labels, the
localized support stylesheet and localized SVG diagram labels all applied and reverted
correctly.

## 11. Before / after

| Observation | Before | After |
| --- | --- | --- |
| Translator's English `<h1>` kept on a Marathi page | No — reverted to Marathi in ~1.2 s | Yes — 0 reverts in all 9 translated languages |
| Mutation records from the site during a translation pass | 104 in one pass, retriggered continuously | 0 writes; 276 of 276 marked text nodes untouched |
| Translation passes triggered by one translator batch | 6 (loop) | 0 — observer is disconnected |
| Long tasks while the translator works | continuous main-thread work (load long tasks measured at 134 / 451 / 98 ms, re-triggered by the conflict) | none (0 ms in the 2 s measurement window) |
| Idle cost on a settled page | observer + digit pass kept running | 0 mutations and ~0 ms of tasks per 2 s |
| First visible frame on a Marathi page | English label "Weight =" / "Carbon Steel" for ~662 ms | Marathi from the first painted frame (0 English frames) |
| History summary line | literal "null" when a key was missing | localized sentence, English fallback |
| Installer popup title | literal `{name} वेट कॅल्क्युलेटर` | full source sentence (never a brace) |

## 12. Confirmed, corrected, not verified

**Confirmed**

- The freeze mechanism: the site's own observer rewrote Chrome Translate's output, and
  Chrome re-translated, indefinitely. Reproduced deterministically.
- The English-first flash on static pages came from the `load` + 500 ms boot delay.
- The technical-language layer fought the translator over four unit-toggle labels.
- The history drawer printed "null"; the installer popup printed an unfilled template.

**Corrected**

- Translator passive mode (both runtimes), narrowed technical observer, idempotent toggles.
- Immediate language application at `DOMContentLoaded`.
- Placeholder guard and null-safe history strings.
- Cache versions bumped (i18n 63, history 29, service worker `mw-static-v134`).

**Not verified / remaining**

- **Chrome's own Translate UI was not driven.** The harness reproduces exactly what Chrome
  Translate writes (`<font>` wrappers, `.skiptranslate`, `#goog-gt-tt`, the
  `translated-ltr` class) and then measures the site's reaction, which is the part the site
  controls. Chrome's translation service itself was never invoked, so "no *This page isn't
  responding* dialog" is inferred from the removal of the conflict, not observed directly.
  A final human pass with the real Translate menu is still worthwhile.
- A few dynamic strings have no dictionary entry (for example the history summary
  sentence in some languages). They now fall back to English instead of breaking; they are
  still untranslated.
- The page is server-rendered in its own language, but the calculator modules still contain
  English literals and are localized by the runtime inside the same task. Converting those
  modules to read translations directly would remove the last runtime dependency; it is a
  larger refactor and was not part of this fix.
- The mobile numeric keypad's tap path was not exercised by the harness.
- Load time on the local single-threaded `python -m http.server` is 0.5–23 s depending on
  cold state and is not representative of production; it is a harness artefact, not a page
  regression. Long-task and DOM counts were measured separately for that reason.

Raw harness output is in `docs/i18n-audit/evidence/` (`gt-report.json`, `report.json`) and
the scripts live in `.tmp/` (`verify-lang.mjs`, `gt-all.mjs`, `marker.mjs`, `churn.mjs`,
`loop.mjs`, `conflict-cost.mjs`, `diag.mjs`, `switch-check.mjs`, `func3.mjs`, `mobile.mjs`).
