---
name: adapt-direct-barter-ui
description: Reinsert or adapt this fork's implemented Direct Barter tab into newer upstream UI and releases, preserving approved historical-market semantics and verifying every integration surface.
---

# Scope and prerequisites

Use for an approved upstream reconciliation or transplant, not unsolicited
feature expansion. Read the current `docs\DIRECT-BARTER.md`, repository
instructions, local diffs, and newer upstream source before editing. The map
below describes the implemented checkout; follow approved later changes and
update the map instead of freezing the feature at this version.

Use the current repository root, obtained with `git rev-parse --show-toplevel`.
Keep commands/documentation repository-relative; do not publish its absolute
machine-specific path or local runtime/session locations.
Fork: `golybevalexander-del/poe2-currency-overlay`.
Read-only upstream: `POE2-VibeTools/poe2-currency-overlay`.
Preserve dirty user work. Do not automatically stash/reset, merge, switch
branches, commit or push. Establish the verified upstream release SHA, previous
imported base and user-approved reconciliation branch first, using
`.github\agents\upstream-release-maintainer.agent.md`.

# Surgical integration map

| Existing paths | Contracts to inspect and preserve/adapt |
| --- | --- |
| `direct-barter\provider.js` | `HourProvider`: official completed-hour GGG fetch, immutable persistent cache, two-download concurrency bound, in-flight deduplication, Retry-After/rate-limit handling, 72-hour cache retention/pruning. |
| `direct-barter\scanner.js` | `scan`, `neighbors`, `resolveItem`, `valuation`: raw Metadata pair identity, league isolation, reverse orientation, aggregation, numeric guards, original per-hour records, independent per-row Exalted valuation. Uses the shared sort helper. |
| `direct-barter\service.js` | `BarterService.query/enrich`: only 3/24 completed-hour windows, dynamic selected league, `schemaVersion: 1` export model, exact requested/covered hours and errors, visibly stale fallback, unavailable state. Scout `SnapshotPairs` is names/icons-only enrichment by exact ApiId/BaseItemTypeId, never market evidence or prices. |
| `main.js` | Instantiate provider/service under fork `userData\direct-barter-hours`; `direct-barter` IPC resolves the existing league through `resolveLeague`, reports errors; `set-barter-mode` validates/saves mode. Preserve config defaults `showBarterTab`, `barterMode`, `tabOrder`, last-tab persistence, `set-tab-shown`, and `active-tab` handling. |
| `preload.js` | `directBarter`, `setBarterMode`, `getConfig`, `onLeagueAutoChanged`, `onShown`, `onItemCopied`, `onItemCopyFailed`, `onBarterFocusSearch`, `setTutorialDismissed`: narrow existing IPC bridge, not renderer Node access. |
| `renderer\index.html` | `tab-barter`, `barter-root`, `show-barter-tab`; load additive localization, shared lookup/sort/presentation/search/controller, stylesheet and tutorial policy. Preserve dependency order alongside `item-tab.bundle.js` and `item\item-tab.js`. Rebuild mounts/scripts for newer upstream conventions, not wholesale obsolete DOM. |
| `renderer\item\item-tab.js` | `TAB_META`, visibility/order, `activeKey`, `setTab`, close/restore, Settings/last-tab startup. `onItemCopied/onItemCopyFailed` route to Barter only while active; outside it retain Price Check. `ItemTab.prepareExchangeLookup/exchangeClipboardName` reuse EE2 initialization/parsing. |
| `main.js`, `renderer\renderer.js` | `onItemHotkey` and `activeUiTab`: existing manual hovered-item copy action; focused overlay sends `barter-focus-search`. Renderer `reportVisibleTab` keeps main informed. Settings tab toggles, league-change invalidation and refresh must include Barter. Preserve other tab/hotkey behavior. |
| `renderer\direct-barter.js` | Picker/neighbor filter, selected card and clear, Buy/Sell, refresh, JSON export, real warning rendering. `requestId`, `captureId`, `pendingCapture`, selected-ID and busy guards prevent late loads/copies from repopulating cleared selection or applying old orientation. |
| `renderer\direct-barter-presentation.js` | `rowView`, `rateText/rateTooltip`, `averageRatio`: actual quantities, named tooltips, valid rates only, game buying:selling orientation and two-decimal normalization. |
| `renderer\direct-barter-search.js`, `renderer\direct-barter-sort.js` | Catalog-wide token/partial/reordered/case-insensitive/typo ranking; exact numeric tokens; literal Metadata lookup; ambiguity and conservative Enter selection. Deterministic value ties and unpriced-last both directions. |
| `renderer\exchange-item-lookup.js`, `renderer\renderer.js` | `ExchangeItemLookup.icon/clipboardMatches/routeToBarter`, `exchangeItemIconUrl`, `currencyIconUrl`: shared main-app EE2 exact-item icon lookup, then existing currency catalog fallback. Barter and Price Check currency cards share it; no separate icon pool/family URL table. Copied gem level and rune specificity survive without fuzzy identity guessing. |
| `cx-map.json`, `cx-catalog.json`, `renderer\vendor\ee2\data\en\items.ndjson`, `renderer\item\ee2-entry.ts` | Metadata/API mapping, bundled catalog, main-app item icons/parser bridge. Compare new upstream metadata/schema and generated data compatibility. An unresolved endpoint must remain, not disappear. Existing `cx-feed.js` drops some markets and other renderer pricing helpers use crosses; neither may replace Barter discovery. |
| `renderer\direct-barter.css`, `renderer\styles.css` | Compact styling, accessible reserved icon space, bright selection/clear, badges; Settings hides the underlying Barter root. Follow newer upstream tokens/design/layout. |
| `renderer\i18n\barter-en.js`, `scripts\i18n-verify.mjs` | Additive `barter.*` catalog and verification loading. Preserve meaningful errors and exact rate copy `No Historical record`; do not use that phrase to assert current availability. Adapt to newer upstream localization conventions. |
| `renderer\tutorial.js`, `renderer\tutorial-start-policy.js`, `main.js`, `preload.js` | Persist `tutorialDismissed` through `set-tutorial-dismissed`; startup and delayed F6-show callback honor it. Explicit Settings replay still works. Do not alter unrelated release-note dialogs. |
| `main.js`, `package.json`, `package-lock.json`, `Start Overlay.vbs`, `PRIVACY.md`, `README.md` | Fork app/profile/model identity, no legacy upstream config migration, `FORK_BUILD` update/live-feed/report/sample-upload guards, disabled `publish`, local-only launcher, documented isolation. Preserve manifests/lockfile coherence and packaging inclusion of feature modules. No installer publication. |

# Data and UX acceptance contract

1. **Membership** comes only from explicitly recorded original GGG
   `market_pair` endpoints for the league and covered hours. Source:
   `https://web.poecdn.com/api/currency-exchange/poe2/<completed-hour-seconds>`.
   Keep raw records, zero-volume markets, unknown IDs and duplicates aggregated
   across hours. No catalog/bucket/override/cross-currency/Scout/trade-site
   inference of neighbors. A recorded zero-volume market need not prove a trade
   occurred or that an offer exists now.
2. **Valuation** is Exalted per ONE row item, independent of membership.
   Prefer direct historical valuation; permitted existing indirect valuation is
   explicitly Estimated. Missing is null/Unpriced, not zero; keep it last for
   both sorts. Preserve source/provenance and deterministic ties.
3. **Direction**: stored `rateBPerA` is row units per selected unit. Sell
   selected receives row item; Buy selected pays row item. Do not invert that
   stored rate a second time on mode change. Average trade ratio is
   row received : selected sold in Sell, selected bought : row paid in Buy.
   Normalize positive original quantities by their minimum, round the other
   side to two decimals and trim trailing zeros: `512:6488 -> 1:12.67`.
   Keep small nonzero amounts truthful. Zero/missing/invalid quantities cannot
   produce a fabricated rate or division by zero. Named tooltips disclose
   historical/rounded context, not current executable buy/sell sides.
4. **Selection/capture**: search all supported categories consistently in
   picker and row filter. `Unc 8`/`Unc8` must return all matching level-8 gems,
   never 18 or numeric metadata substrings; reordered/partial/typo queries for
   runes, currency, soul cores and omens must work. Keep ambiguity explicit.
   Existing manual Ctrl+F capture fills exact exchange search while Barter is
   active; outside it Price Check is unchanged. Focused-overlay Ctrl+F focuses
   search. Invalid/nonexchange/copy-failure messaging must be visible. No new
   game automation, fuzzy auto-selection or unsupported live capture endpoint.
5. **Presentation**: preserve Buy/Sell mode settings, prominent selected
   name/icon, accessible clear button (labelled `Clear selected item`) and
   no-rescan/stale-response guards. Shared item icons only; genuine missing
   icons reserve space gracefully. Keep the simplified table: no Last observed,
   per-row raw-detail disclosure or default fetched/covered timestamp paragraphs.
   Keep Historical/Recent heading, 3/24 window, explicit league, unknown current
   availability, valuation badges and real partial/stale/unavailable/errors.
   JSON retains raw quantities, source URLs, observation/fetch times and
   requested/covered hours separately from export time.

# Integration procedure

- Diff the verified newer upstream ref against the actual shared/imported base
  and the current fork. Separate upstream changes from fork-only changes and
  uncommitted user edits. Do not use the version string as an ancestry proxy.
- Identify changed owners of tab navigation, state/settings, source transport,
  parser/metadata/icons, IPC and initialization. Keep provider/scanner/service
  isolated; wire the tab into the new owners and current design conventions.
- Check official GGG API semantics and Scout metadata schema if affected.
  Keep snapshot epochs separate from covered GGG hours. Numeric strings and
  invalid values require guards; names/icons never determine pair membership.
- Inspect `LICENSE`, `renderer\vendor\ee2\LICENSE` and `package.json`.
  Retain GPL-3.0-or-later and upstream attribution; preserve vendored MIT notices.
- Update the current feature documentation and tests for approved integration
  changes. Do not change history limits, restore verbose UI, enable upstream
  updating/reporting, or add endpoints simply to make tests pass.

# Existing verification commands

Run from the checkout with a working Node/npm and restored local dependencies:

```powershell
# Run from the repository root.
npm.cmd run test:barter
npm.cmd run build:item
node .\scripts\i18n-verify.mjs
node --check .\main.js
node --check .\preload.js
node --check .\renderer\direct-barter.js
node --check .\renderer\item\item-tab.js
git diff --check
npm.cmd run test:barter-ux
```

Run each only after inspecting the previous result; stop on failure. These are
the current actual scripts, not a promise that every future upstream keeps the
same names. Re-read `package.json` after migration. Do not install validation
packages merely for convenience; restore missing dependencies only as needed
from official sources. Do not run `dist`/publish as part of this skill.

Regression owners: `direct-barter\scanner.test.js`,
`direct-barter\provider.test.js`, `direct-barter\presentation.test.js`,
`direct-barter\search.test.js`, `direct-barter\icons.test.js`,
`direct-barter\tutorial.test.js`; real Electron fixtures in
`scripts\smoke-barter-ux.js` and `scripts\fixtures\barter-ux.html`,
`scripts\fixtures\barter-ux-preload.js`, `scripts\fixtures\barter-ux-lookup.js`.
Confirm membership/orientation/zero/unknown/league/window tests; direct vs
estimate/unpriced sorting; real shared icon decoding, compact DOM, exact capture,
clear/load races, mode persistence and partial/stale/error visibility.

For full app startup/data/export/old-tab/hotkey registration checks, inspect
running processes first; never kill the user's app. The existing
`npm.cmd run test:barter-smoke` runs `scripts\smoke-direct-barter.js` against the
fork profile and can affect its tab/settings state. Run only when safe, disclose
that scope, and preserve user settings; use the isolated UX fixture if blocked.
On Windows, direct Electron GUI invocation may return before the process exits:
use `Start-Process -Wait -PassThru` with explicit stdout/stderr artifact paths
when necessary to verify a real PASS/exit code, not just successful launch.

Follow `docs\DIRECT-BARTER.md` for the manual checklist and restart command:
`& .\node_modules\electron\dist\electron.exe .`.
DOM/IPC testing is not visual testing or actual in-game Ctrl+F verification.

# Stop and hand off

Stop on changed API semantics, unresolved metadata interpretation, profile or
hotkey conflicts, licensing conflicts, an unsafe transplant, or remaining
regression failures. Report exact evidence and ask for the needed decision;
never scrape/reverse-engineer an unsupported live endpoint or infer missing
pairs. Summarize release/base SHAs, files, actual checks, runnable launch/manual
review, and limitations. Leave local changes for the user. Publication is a
separate authorization and uses `create-fork-pr`.
