# Direct Barter fork

Direct Barter is a separate tab in the Electron overlay. It lists only the
recorded direct neighbors of one specifically selected exchange item, in the
league selected in Settings and the last 3 completed hours (or 24 hours).
Typing `Rune` offers individual choices; it never creates a synthetic Rune item.
Target filtering provides pair-specific lookup.

The compact header keeps **Historical markets**, the league and unknown-current-
availability warning on one wrapping context line. Sell/Buy, the item picker,
3h/24h history, Refresh and Export share a wrapping toolbar. After selection, a
compact item/name/icon control replaces the search field; **Change** or Ctrl+F
reopens search without clearing the selection or fetching data, and Escape
returns to the selected item. Suggestions overlay the results instead of
pushing them downward. Clearing the item restores the search-only state.
Target/ratio filters, the recorded-markets checkbox and Export are hidden until
an item is selected. Empty suggestions/status messages reserve no vertical space.

The **Average trade ratio** dropdown filters rows below, exactly at, or above
1:1 in the displayed buying:selling direction, or shows only rows with no
historical ratio. **All ratios** includes every row admitted by the activity
checkbox. Comparisons use original quantities before display rounding and
compose with the target text filter and Exalted, volume or alphabetical item-name
sorting. Switching Buy/Sell reapplies the filter without fetching data.
JSON export retains every recorded neighbor and records `averageRatioFilter`,
`showRecordedWithoutTrades`, `sortKey` and `sortDirection` separately, just like
the target filter. Clearing the selected item resets the filters and hides
zero-trade rows again.

**Historical Trade Activity** distinguishes **Item was traded** from **Item
listed**. The latter means a market was recorded historically without a valid
traded rate, not that an offer is currently available. Such rows are still
gathered and exported, but are hidden until **Show recorded markets without
historical trades** is checked. The checkbox combines with text/ratio filters
and does not refetch data.

**Trading volume** shows total units of the row item traded in the covered
3/24-hour history, using the Currency tab's shared `k`/`m` formatter, highlighted
high volumes and shared hover-tooltip styling. The tooltip names both item
quantities. Buy/Sell changes who pays, not these historical per-item totals.
Only records with valid positive quantities on both sides contribute to these
totals (`tradedQuantityA`/`tradedQuantityB` in JSON). This is **not a transaction
count**: the public feed and main app do not expose the number of individual
trades. Partial/stale coverage warnings still apply to volume.
Click **Trading volume** to show the highest quantities first, then click again
for the lowest first. Sorting uses raw quantities, never abbreviated strings;
unknown or invalid volume stays last in both directions. Sorting is retained
through Buy/Sell changes and refresh, and is recorded in the JSON export.

The title-bar refresh button refreshes both Currency and Direct Barter,
regardless of the visible tab. It preserves the selected item, history window,
Buy/Sell mode, filters and sorting. Repeated general refreshes do not start
overlapping Direct Barter requests; its own Refresh button remains available.
Completed cached hours are reused, not forcibly downloaded again.

Use **I want to Sell / Buy** to choose the direction. Sell selects the item you
give; rows are the items you receive. Buy selects the item you want; rows are the
items you pay with. Mode is saved in the fork profile and changing it rerenders
the already covered data without making a new history request.

**Historical markets** is intentional. These are hourly
digests, not executable bids/asks, spread, current inventory, or a guarantee that
you can trade now. The latest observation is the start of the newest recorded
hour, not an exact trade timestamp. Fetched/checked time is separate; raw records
also preserve each hour's original fetch time.

## Running on Windows

Run commands from the root of your repository checkout.
Feature branch: `feature/direct-barter`.
No commit, push, PR or installer publication is needed to run this build.

Once local dependencies and item-tab assets have been restored/built, launch
without needing Node on PATH:

```powershell
# Run from the repository root.
& .\node_modules\electron\dist\electron.exe .
```

Alternatively, double-click `Start Overlay.vbs`. It launches only the local
Electron executable and does not run `npx` or download anything. Use the tray
menu **Show / Hide overlay** or F6; the overlay normally starts transparent.
If the installed upstream app is running, exit it first or rebind the fork's
hotkey to avoid contention. Its settings and install are not modified.
Skip/complete the existing first-run tutorial if it covers the navigation.

For rebuilding edited sources, with Node installed from <https://nodejs.org>:

```powershell
# Run from the repository root.
npm.cmd ci --registry=https://registry.npmjs.org
npm.cmd run build:item
npm.cmd start
```

If using a portable Node runtime, add its directory to your local PATH before
running npm. Keep that machine-specific path in local settings, not public
documentation.

Only official sources were used: `nodejs.org` with its published SHA-256
checksum, `registry.npmjs.org`, and the packages' maintainers' release artifacts.
The fork profile/cache is under
`%APPDATA%\POE2 Direct Barter Fork`, separate from the installed upstream app.

### Windows installer

The local Windows x64 installer for **3.0.7-barter.1** is
`dist\POE2-Direct-Barter-Fork-Setup.exe`. It installs per user and creates desktop
and Start Menu shortcuts; the installed app does not require Node/npm.
It is unsigned, so Windows may show a SmartScreen warning. Upstream automatic
updates remain disabled. No installer has been published.

To rebuild locally without publishing:

```powershell
npm.cmd run dist -- --publish never
```

The packaged executable is
`dist\win-unpacked\POE2 Direct Barter Fork.exe`. Its startup, native dependency
loading, Direct Barter controls and matching release-notes version were checked
using an isolated temporary profile. The archive includes the root GPL license,
vendored EE2 MIT notice, README and privacy statement. The installer itself has
not yet been installed/uninstalled for acceptance testing. Installation,
shortcuts, settings persistence and in-game hotkeys still need manual review
before distribution. Exit the upstream overlay before testing shared hotkeys.

## Manual review checklist

1. Open Direct Barter. Confirm **Historical markets**, the
   explicit league and default 3-hour window. Current
   availability must be described as unknown.
2. Type `Rune`. Confirm multiple specific entries and no automatic selection.
   Search accepts partial/reordered words, conservative typo matching and exact
   numbers across all catalog categories: `iron gre run`, `opiloti soul core`,
   `exaltde orb`, `barter omen`, `Unc 8` or `Unc8`. Both latter queries must find
   Skill and Spirit gems at level 8, not 18. A `Metadata/...` query performs a
   literal ID lookup. The same token rules apply to the row filter. Fuzzy
   candidates are ranked; low-confidence matches never auto-select on Enter.
   Use Up/Down arrows to highlight a choice and Enter to explicitly select it,
   including a fuzzy candidate. Navigation wraps and scrolls the active choice
   into view without moving focus out of the search field. Escape closes the
   choices; editing the query clears the highlighted choice.
   Choose **Greater Storm Rune**. Look for **Greater Iron Rune** using the target
   filter. The real 2026-10-04 15:00 UTC Forbidden Rites digest recorded this
   pair at 1:1. It may disappear in future windows; choose an actually recorded
   pair or 24 hours rather than expecting fixture data to stay current.
3. The repeated per-row historical-details expanders are intentionally hidden.
   Use JSON export to inspect `market_pair`, `volume_traded`, the source URL/hour,
   original ratios and stock. Raw data is retained unchanged. Those are historical
   fields, never current offers. Search a raw unresolved Metadata ID if one
   appears; it must remain selectable and visible.
4. Check the bright **Selling: item name** card and its icon. Hover a historical
   rate to see the actual named exchange (rounded values are explicitly marked
   approximate; whole-item equivalents are used only when exactly supported).
   Switch to Buy and confirm the card says **Buying**, rows say **Pay with**,
   rates name what you pay for the desired item. **Average trade ratio** follows
   the game's buying:selling order: selected bought : row paid in Buy,
   row received : selected sold in Sell. The smaller side is 1, the other
   rounded to two decimals with trailing zeros removed. Hover for named items.
   **Receive item / Pay with** sorts alphabetically in either direction.
   The sortable Exalted column always values ONE row item.
   Click **Exalted per receive item** twice. Check ascending then descending,
   with **Unpriced** last both ways. This is the value of ONE receive item, not
   proceeds from selling your selected item. **Direct historical**, **Estimated**, and **Exalted
   unit** badges identify valuation provenance. Rare items/windows may be
   needed to see an estimate or unpriced target; automated fixtures exercise
   both deterministically.
5. Check **Show recorded markets without historical trades** to reveal a recorded
   zero-volume result if present. It must remain available with
   **No Historical record** in rate/ratio columns instead of a fabricated traded
   rate. This wording means there is no valid historical traded rate, not that
   the market itself is absent. Activity distinguishes
   **Item was traded** from historical **Item listed**. Uncheck the box and
   confirm the latter rows disappear without a request, but remain in JSON.
6. Switch Settings league and return to Direct Barter. Confirm the displayed
   league and results change, without mixing old-league rows. Switch to 24
   hours and Refresh. Missing coverage/stale/errors must remain visible; precise
   covered/fetched timestamps are in JSON, not the default table. Repeat Refresh;
   immutable cached hours should be reused, not downloaded again.
7. Use **Export JSON**. Confirm league, requested/covered hours, selected
   Metadata ID, null unpriced values, valuation provenance, and original raw
   per-hour records. Export contains all selected direct neighbors; the current
   target filter and sort direction are recorded separately.
8. Optional outage check: first load data, disconnect networking, then Refresh.
   Completed cached GGG hours remain valid; Scout metadata may report an error.
   Missing newly requested hours produce partial coverage. If all requested
   hours are unavailable, older retained hours are explicitly **STALE CACHE**;
   with no cache, the UI reports unavailable, not an empty-market success.
9. Close the tab with its X, restore it via Settings, and drag-reorder it. Restart
   to check tab order/visibility and last-tab persistence. Verify Settings hides
   the underlying Direct Barter view.
   The selected card's separate **×** clears the selected item, results, target
   filter and export state, then focuses the search. It does not rescan. Even
   if a request is still pending, its late response must not restore the
   cleared selection.
10. Switch to Currency, Price Check, Desecrate and other existing tabs. Check
    bucket rendering, F6 hide/show, and your existing item price-check workflow.
    Direct Barter must not add indirect neighbors or apply manual price
    overrides. The fork's upstream feedback/update/upload controls are disabled.
    Close the welcome tutorial once in this updated build; F6 hide/show and
    restart must not reopen it. Settings' explicit tutorial replay remains
    available. Older builds did not save the "later" dismissal, so that old
    dismissal cannot be recovered automatically.
11. With Barter active, hover a game item and press the existing item hotkey
    (default Ctrl+F). Its copied exact exchange name fills the item search; click
    the specific entry to select it. Gem level and rune specificity must survive.
    Buy/Sell mode is retained. Unknown/nonexchange items show a message, never
    a fuzzy guess. With the overlay itself focused Ctrl+F focuses search; you can
    paste the game's copied item text there. Outside Barter, the hotkey still opens
    Price Check. Actual in-game capture requires your normal copy-capable game
    context; automated tests cover the received events, not game interaction.
    Some entries in the game's exchange window do not support even manual
    Ctrl+C; the hotkey cannot extract text that the game does not copy. In that
    case the UI explains the limitation and directs you to type the name or
    copy an inventory/stash item. Failed Barter capture never substitutes old
    inventory clipboard text; the existing manual-clipboard fallback outside
    Barter is unchanged.

## Icon repair and mode semantics

The CX currency catalog had legacy uncut-gem icon URLs returning **404**, but
the main app's vendored EE2 item database already has the working level-specific
official `/gen/image/...` URLs. Barter and the Price Check currency card now share
that exact item lookup across both the `ITEM` and `GEM` namespaces, preferring
the matching API identity before falling back to the existing main currency
catalog.
Lineage support gems such as Vilenta's Propulsion, Uruk's Smelting and Arakaali's
Lust live in `GEM`, not `ITEM`; checking only `ITEM` incorrectly fell through to
legacy art URLs returning 404 despite working icons already in the main app.
There is no Barter-specific dynamic icon pool, family URL table or icon download
pack. The selected card and rows use the same resolver. Actual EE2 database
lookups and real Electron image decoding are checked without changing identity
or discovering pairs from icons.
Scout enrichment can also resolve a recorded endpoint by its exact
`BaseItemTypeId`, even when the bundled map lacks that ID. Missing metadata
fields fall back individually to the bundled catalog. Genuine unknown/broken
icons leave a reserved `?` slot rather than shifting the item text.

The picker includes **Lesser Essence of the Mind** and **Lesser Rebirth Rune**
from the bundled catalog even without Scout metadata or a recorded market in
the chosen window. Their exact IDs are `CurrencyLesserEssenceMana` under
`Metadata/Items/Currency/` and `RuneLifeRecoveryLesser` under
`Metadata/Items/SoulCores/`. Scout entries with an explicit `BaseItemTypeId` can
also extend the picker; names alone never establish identity. Selecting any
catalog item still shows only its original GGG-recorded neighbors. Catalog
regeneration retains previously known entries and API IDs instead of removing
items absent from its single sampled hour.

For a recorded `162 Greater Iron Rune / 41 Divine Orb` traded total,
Sell Iron Rune means approximately `0.253086 Divine Orb` received per Rune;
Buy Iron Rune means approximately `0.253086 Divine Orb` paid per Rune. That
payment rate is the reciprocal of `162/41 Runes per Divine`, not an extra
inversion of the stored neighbor-per-selected rate. Buy totals are
`41 Divine paid / 162 Runes bought`; Sell totals are `162 Runes sold / 41 Divine
received`. Both are views of the same undirected historical record, NOT bid/ask
quotes or proof of an executable buy or sell side. Mode changes never affect
direct membership, rate validity, or per-row-unit valuation; zero-volume rows
still say **No Historical record**.

Raw per-side quantities and observation/fetch timestamps remain in JSON. The
average ratio is a presentation of those quantities, not a new market quote:
512 bought / 6488 paid normalizes to **1 : 12.67**, not 1 : 12.72. It is
historical and approximate when rounding is needed. Redundant coverage prose,
Last observed column and raw-detail expanders are omitted from the default UI;
real partial/stale/error warnings and valuation source badges stay visible.

The welcome reappearance came from the first-run tutorial's `onShown` handler:
the old "later" action cleared only the active card, leaving `tutorialDone`
false, so every subsequent F6 scheduled another start. Dismissal now saves a
separate `tutorialDismissed` flag immediately, and both the show handler and
its delayed callback check it. Explicit Settings replay bypasses automatic
startup suppression. Release-notes behavior and upstream profiles are unchanged.

## Sources, valuation and implementation

### Standard Iron Rune / Soul Core of Opiloti investigation (2026-10-04)

The screenshot showed a live available 1:1 offer. The overlay showed completed
hours **13:00, 14:00, 15:00 UTC on October 4**. All three digests were available.
This was **not a mapping/scanner bug**: that exact direct pair was not recorded
in those hours, but does appear in the longer historical window.

| UTC hour | Standard market records | Iron Rune records | Opiloti records | Exact pair records |
|---|---:|---:|---:|---:|
| Oct 4 13:00 | 288 | 3 | 0 | 0 |
| Oct 4 14:00 | 332 | 3 | 1 | 0 |
| Oct 4 15:00 | 315 | 1 | 1 | 0 |
| 3-hour total | 935 | 7 | 2 | 0 |
| Oct 3 16:00 through Oct 4 15:00 (24 completed hours) | 6,668 | 36 | 12 | 1 |

The sole 24-hour pair record is **2026-10-03 23:00 UTC**, GGG hour
`1791068400`:
<https://web.poecdn.com/api/currency-exchange/poe2/1791068400>.
Its league is `Standard`, its original pair is
`Metadata/Items/SoulCores/RuneEnhanceGreater` /
`Metadata/Items/SoulCores/SoulCoreBleed`, and `volume_traded` is **1 / 1**.
Both lowest/highest ratios are **1 / 1**; lowest/highest stock is **0 Iron Rune /
1 Soul Core**, historical only. The scanner returns **Soul Core of Opiloti**
at rate **1**, quantity totals **1 / 1**, with that observation hour when the
24-hour window includes it. Reverse selection also works.

The bundled map and Scout both identify `SoulCoreBleed` as
`soul-core-of-opiloti`. Do not confuse it with the different item
`SoulCoreSpecial8` / `opilotis-soul-core-of-assault`. Scout's Standard
SnapshotPairs response at investigation time contained 305 pairs and both item
identities, but no direct Iron Rune / Opiloti pair; Scout remains metadata-only.

To review it: choose **Standard**, select **Greater Iron Rune**, switch History
to **Last 24 completed hours**, then filter **Soul Core of Opiloti**. The default
remains three hours; the app does not automatically broaden scans. The record
will disappear once October 3 23:00 leaves the requested window. A live offer
does not establish a record in the latest completed-hour digests, and these
older records do not guarantee a live offer.

### Can the app confirm an offer without an executed trade?

A trade is not strictly required for historical inclusion: GGG digests contain
zero-volume market records, and this tab preserves those records without
inventing a traded rate. However, no supported public endpoint exposing the
game's live **Available Trades** list has been verified for this implementation.
The public trade-site listings are a different market. If a direct pair is
absent from the covered digests, the app cannot confirm or deny its current
offer availability. Check the in-game exchange for live availability; expanding
history reveals only older recorded markets, not a live order book.

- `direct-barter/provider.js`: GGG completed-hour transport, persistent immutable
  cache, 72-hour retention, two concurrent requests, in-flight deduplication,
  Retry-After/rate-limit cooldowns and per-hour retry delays. Only missing hours
  are fetched. Raw data spans leagues; filtering happens before graph creation.
- `direct-barter/scanner.js`: original Metadata-ID pair identity, per-league
  scanning, multi-hour deduplication/aggregation, item resolution and valuation.
  Unknown endpoints and zero-volume records are preserved irrespective of
  catalog pricing or configured currency buckets.
- `direct-barter/service.js`: 3/24-hour coverage, metadata enrichment, explicit
  errors/partial coverage and clearly labeled older-cache outage fallback.
- `renderer/direct-barter.js`: isolated tab UI, explicit item selection,
  filtering, details, refresh and local JSON export. Shared sorting logic is
  tested and used by both renderer and scanner.

Historical rate is total B divided by total A across records with valid positive
quantities on BOTH sides. Invalid/one-sided records are kept but do not skew
rates. Displayed historical quantity totals include all valid reported
quantities; a missing/invalid quantity makes that side's total unknown.

Valuation is **Exalted per one target B**, independent of A/B membership:
direct B/Exalted historical traded quantities first, then an explicitly
**Estimated** Chaos/Divine one-hop fallback matching the existing `cxValueEx`
valuation policy. A target without a usable value is **Unpriced**, never zero.
Exalted itself has unit identity value 1. Valuation hours/provenance appear in
details/export. No manual overrides are read by this tab.

Scout `SnapshotPairs` is used for names/icons only, never for direct membership,
rates or valuations. Its snapshot prices/epochs are therefore not silently
blended with GGG hours. Bundled mapping/catalog and raw IDs cover outages.
No trade-site bulk listings, routes, arbitrage, CLI, or game automation are
part of Direct Barter. Existing pricing functions are unchanged.

## Automated checks and limitations

```powershell
npm.cmd run test:barter
npm.cmd run build:item
node scripts\i18n-verify.mjs
npm.cmd run test:barter-smoke
npm.cmd run test:barter-ux
```

The Node tests cover direct/reverse membership, indirect-only rejection,
catalog/bucket independence, unknown IDs, zero/invalid quantities,
multi-hour pairs, league/window isolation, target-unit valuation, sorting,
API failures, partial/stale coverage, persistent caching, throttling,
metadata-only enrichment, and JSON null/provenance shape.

The Electron smoke exercises actual startup, preload/IPC, configured league and
GGG data, ambiguous search, Greater Iron Rune's recorded neighbors, named rate
tooltips, selected-item highlighting/icon failure handling, sorting, filtering,
JSON raw data, Settings layout, existing tab navigation and F6 registration.
It is a DOM/IPC check, **not visual verification or an in-game trade test**.
Its actual-market assertion can legitimately fail if Iron Rune has no recorded
neighbors in the current window. Close the running fork before the main-process
smoke so the single-instance lock does not redirect it into your existing app.

The isolated real-Electron UX fixture checks level-8-only search, decoded
selected/row gem images, hidden details DOM, Sell/Buy quantities/tooltips/sorting,
clear during an intentionally held request, late-response suppression, mode
changes during a request and mode restoration after renderer reload. It uses
its own temporary profile and does not register hotkeys. Tutorial regressions
exercise the actual dismissal and `onShown` handlers, including saved-dismissal
restart and explicit replay. These checks do not constitute visual/in-game
verification.

Translations for the new tab currently fall back to the additive English
catalog using the existing localization mechanism. Provider outages can leave
partial coverage; no claim is made about missing hours or current availability.
Original upstream GPL-3.0-or-later license and attribution remain unchanged.
