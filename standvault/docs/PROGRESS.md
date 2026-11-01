# StandVault - progress and handoff

Read this first when starting a new session. The full step prompts are in `C:\Users\USER\25oct26\StandVault - All Steps.xlsx` (sheet "All Steps"); the agreed decisions are in its "Brief" sheet.

_Last updated: 2026-10-26_

## Current direction (decided 2026-10-26) - read this first

The user reviewed the mock app and changed priorities:
- **Full stands only for now.** Zones and objects are parked until every stand is in the library.
- **Stand names start with the size**: `ST_<Width>x<Depth>_<Show><Year>_<Client>_<####>`, metres, width x depth, e.g. `ST_10x10_GITEX2025_DEWA_0007` (`4p5x3` = 4.5 x 3). The theme is a search tag for stands, not part of the name. Zones/objects keep their old format. Done in `config/naming.js`, `docs/NAMING.md`, tests 9/9
- **All stands from D: and E:** - scan folders now D:\ plus E:\ige, E:\FREELANCE, E:\designs, E:\2021, E:\2020, E:\2019 (user's list). `E:\ige\MESH` is excluded: it is a bought Evermotion model library (12,138 files) for the objects phase later
- **One card per project**, versions inside (newest first); the user picks the good version
- Agreed plan: (1) scan E: + read size/show/year/client from names + group versions - DONE; (2) real database + load all stands (Step 5 brought forward, Step 4 testing later) - DONE; (3) a **daily review** screen - DONE: next 10 unreviewed stands, confirm it is a stand, size, show, client, open sides (inline/corner/peninsula/island), pick best version and preview. The user plans ~10 stands a day
- Size is not stored in .max files. It comes from names where written (`findSizeInText`), otherwise the user types it in the review. Measuring scenes with 3dsmaxbatch overnight is a possible later helper (suggestions only)

## What StandVault is

A personal 3D asset library for an exhibition stand designer. It catalogues their 3ds Max files (Max 2026, V-Ray and Corona) so they can search past work in three levels (Full Stands > Zones > Objects), see previews, and send assets into 3ds Max with their textures. Single user, runs locally, no login. The user has no coding experience: explain in plain English, show results as tables, and ask before anything irreversible.

## Agreed decisions (don't re-open these)

| Topic | Decision |
|---|---|
| Levels | ST Full Stand, ZN Zone/Space (majlis, meeting, reception, pods...), OB Object (vegetation, chairs, people, lighting...) |
| Filters | Theme, renderer, favourites, type, missing textures, no preview |
| Rating | Favourite (heart) + automatic "used in X projects" counter. No stars |
| Getting assets in | "Save to Library" button in 3ds Max (Step 6) harvests zones/objects out of old stand scenes into new library files |
| Getting assets out | Open Folder / Copy Path first; "Send to Max" in Step 6: merge onto its own layer, copy textures into `<Project>/maps/<AssetID>/` automatically, repath, warn on renderer mismatch |
| Original files | NEVER renamed, moved or re-saved. Names are applied to the library copies at harvest time |
| Max version | User works in 3ds Max 2026 |
| Later / separate project | Theme moodboards |

## Step 1 - Setup and naming rules: DONE

- (Later change) `config/naming.js` reads the taxonomy via a JSON import so the web app can use it; tests still 7/7

- Project: `C:\Users\USER\25oct26\standvault` (separate from the PulseFit class project in the parent folder)
- `config/taxonomy.json` - levels, zone types, object types, themes, renderers (approved by user as is)
- `config/settings.json` - scan `D:\`, library `D:\StandVault_Library` (excluded from the scan), Max 2026 batch exe path
- `config/naming.js` - validator, suggestions, Asset ID builder, short IDs, object-name rules, default-Max-name detection
- `docs/NAMING.md` - the rules in plain English with 10 examples
- `npm run test:naming` (7 tests, all passing), `npm run check-name -- "<name>"`, `npm run init-library`
- Library folders created at `D:\StandVault_Library` (Stands, Zones/<type>, Objects/<type>, db)

## Step 2 - Inventory scan: DONE for D: (2026-10-25); extended to E: (2026-10-26, see "Current direction")

E: additions (2026-10-26):
- `scanner/ole.js` reads the FAT lazily (only sectors a chain needs). Before, big scenes on E: (a hard disk) took minutes each; now ~0.5 s. Results identical
- `read-metadata.js` caches each result in `metadata-cache.ndjson` (append per file) and resumes. D: + E: = 5,809 scenes in ~100 s; VRay 4,912, Corona 741; most saved for Max 2015
- `scanner/stand-details.js`: project folder (the folder above `MAX`/`3d`, skipping option/date/version/merge/reference folders), client (before "@" or the show), show (from `taxonomy.shows` + aliases), year (a year word, else the work date), size (`findSizeInText` on file, project and client folder names), suggested Asset ID, and a group key: client|show|year when all known, else the project folder
- `build-inventory.js`: duplicates use a fingerprint (size + SHA-1 of first and last 4 MB; `fingerprint-cache.json`) instead of full hashes; writes `stands.json` / `stands.csv` (one row per stand project with its versions); classification knows E: folders (year folders, ige, designs, FREELANCE are project folders; MERG/PIECES/MESH are parts; REFFERENCE/reff are references)

Run in this order (all read-only, all output in `scanner/output`):
1. `npm run scan:files` (`scanner/find-files.js`) - 326 .max files on D: (71.9 GB), 5 backups set aside (any folder with backup/autoback/autosave in its name, e.g. `_claude_backups`), 0 unreadable
2. `npm run scan:meta` (`scanner/read-metadata.js` + `scanner/max-info.js` + `scanner/ole.js`) - reads each file's File Properties data and Asset Tracking list (`FileAssetMetaData3`: full texture paths) without 3ds Max, plus the embedded thumbnail (243 files have one) -> `metadata.json`, `thumbs/<id>.png`. 1.4 s
2b. `npm run scan:archives` (`scanner/scan-archives.js`) - looks inside the 425 .zip/.rar/.7z on D: with Windows' built-in tar (and .NET for zips whose names tar can't read). A zipped .max already on disk unzipped (same name + size) is only noted (92); every other one is extracted alone to `scanner/output/_archive-tmp`, read, deleted (94 read). Cached per archive in `archive-cache.json`; failed archives are retried next run. 5 archives need 7-Zip (non-Latin file names in .rar/.7z; minor downloaded models/Corona sample scenes) - 7-Zip is not installed. 6 `._*.zip` are macOS junk
3. `npm run scan:inventory` (`scanner/build-inventory.js`) -> `inventory.json`, `inventory.csv` (UTF-8 BOM, 29 columns, checked), `summary.md`. About 65 s the first time (hashing), seconds after that: hashes are cached in `hash-cache.json`, so an interrupted run resumes. `-- --limit 10` writes the pilot versions (`inventory-pilot.*`, `summary-pilot.md`)

How the inventory decides things:
- **Textures**: each link is `ok`, `nearby` (a copy inside the scene's own folder - usually a Max Archive that recreated the original folders), `elsewhere` (only a same-named file somewhere on D:) or `missing` with a reason (drive Z:/G:... not connected, network location, Chaos Cosmos, from another computer, no folder stored, not found)
- **Renders**: images inside the scene folder or a render-like sub-folder, or beside it (Project\3d + Project\Renders). Folders holding several projects only claim images lying directly in them. Moodboards/slides/references and texture-like names are skipped. Embedded thumbnail is the fallback
- **Stand vs single asset**: points for project folders (Projects, Portfolio, Accounts...) +3, stand-like own name (`Client @ Show`, `OP 1`, `Option 2`, show names) +3 (or +1 if only the project path has one), objects >= 300, size >= 100 MB, renders; minus for library/resource/template/merge/xref folders (-4), `Models` folders (-2: stands often live in `3d\Models\<Stand>`), references (-1), < 50 objects (-2). The inbox (`00_INBOX`, desktop) is neutral even though it sits inside `Work\Library`. For archived scenes the folders inside the archive count too. Stand at 4+. The reason is stored per file (`classReason`)
- **Archived scenes**: path is `<archive>\<entry>`, `archive`/`entry` fields set; textures packed in the same archive count as `nearby`; duplicates among archived scenes = same name + size. Loose files also found zipped get `alsoZippedIn`
- **Harvest score** (top 20): stands only, one per folder, not duplicates; renders, content, recency, few missing textures
- **Files saved by Max 2027 are left out** of the inventory (user said to ignore them); only counted in the summary

Results (reported): 414 scenes (94 from inside archives), 204 likely stands, 210 single assets; 311 with missing textures; 85 with no preview at all, 246 with only the small thumbnail; 11 duplicate groups (12 extra copies, 2.7 GB); 48% of objects have default names (40% in stands, 58% in assets)

Safety for every step: never write outside `scanner/output` (and later the library); never modify an original .max, texture or render.

## Two-pass review (decided 2026-10-28, user's idea)

1. **Quick sort** (`pages/Sort.jsx`, `GET/POST /api/sort`, `POST /api/sort/undo`): pages of 24 cards with the guessed category; click wrong ones + key 1-7 / N (not a project); Enter saves the page; Ctrl+Z undoes the last page. Sets `stands.type_confirmed_at` (also set when approving or when the type is changed in the editor). Stats: `unsorted`
2. **Detailed review per category**: Daily review has a category selector (`GET /api/review?type=`), default Exhibition stand. Each category has its own questions (stand: size/show/open sides; event: setting/occasion/elements)
- Library: category buttons with counts above the search (replaces the project-type dropdown)
- `npm test` 22/22
- **How the user runs it:** `Start StandVault.cmd` (project root): builds the web app, then runs only `node server/index.js` on PORT 5173 (the server serves `app/dist` + the API), in a loop that restarts it if it stops; output appended to `app/server.log` (uncaught errors are logged with a time stamp, then the process exits and is restarted). Link stays http://localhost:5173. `npm run dev` (Vite on 5173 + API on 5174) is for development only and clashes with it on port 5173 - stop one before starting the other. An app started from a Claude session stops when the session ends, so don't rely on that for the user
- 2026-10-28: the user hit "Failed to fetch" - the whole app had stopped (no log then); reason unknown, which is why the restart loop and the log were added

## Step 6 - 3ds Max tools: Send to Max BUILT 2026-10-26, waiting for the user's first test in Max; Save to Library next

- Safety net first: `npm test` (root) = naming tests + `app/server/server.test.js` (node:test; spawns the real import and server against a temp library via `STANDVAULT_LIBRARY` / `STANDVAULT_SCAN_OUTPUT` env vars; 10 tests). 19/19 passing
- **This PC has Corona only, no V-Ray.** ~4,900 scenes are V-Ray: Send to Max merges them with a clear warning (V-Ray materials come in as missing)
- `max-tools/`: `install.ms` (drag into a viewport; writes `StandVault_startup.ms` into `getDir #userStartupScripts`, which filein's `standvault.ms` from max-tools), `standvault.ms` (macroScripts + menu via `#cuiRegisterMenus` callback - menu shows after a restart; placement modes asSaved/origin/selected; `sv_mergeAsset`: mergeMAXFile #mergeDups #renameMtlDups #neverReparent, missing DLLs/files logged not prompted, own layer, placement by bottom centre, repath walking materials/sub-maps + lights/proxies by full path then unique file name), `standvault_max.py` (listener 127.0.0.1:5175, token file `%LOCALAPPDATA%\StandVault\max-listener.json`, rejects requests with an Origin header, jobs run on the main thread via QTimer, state kept on `sys` so reloads work)
- Server: `app/server/max.js` `sendStand` (best/newest version; refuses newer-than-2026 files; unpacks archived versions once into `<library>\cache\archives\<hash>`; copies textures to `<project>\maps\<AssetID or SV_title>\` - reuse if same size, `_2` suffix for same-name different files, nothing overwritten; renderer warnings; then POST /merge; used_count +1 and usage_log); `POST /api/stands/:id/send` (one at a time, 503 when Max isn't listening)
- Tested: `sv_mergeAsset` in headless 3dsmaxbatch on a real Corona stand (201 objects, 26 paths repathed to copies, placed at origin, source hash and date unchanged); the whole server flow with a fake listener on a DB copy (Corona, V-Ray warning, zip unpack, re-send reuses textures)
- Not yet tested: the listener and menu inside the user's interactive 3ds Max (needs the user), toolbar (not built - menu only, essential)
- Guide: `docs/MAX-TOOLS.md`. User installed and sent ADIO @ MITE 2026 successfully (2026-10-26). Fixed on the way: the listener failed silently because `SV_ROOT` ends in "\" (broke the Python string) - now forward slashes and a visible error
- **Save to Library BUILT 2026-10-26** (waiting for the user's first test in Max):
  - 3ds Max 2026 bug: `saveNodes` crashes ("BinaryFormatter ... removed", State Sets plugin `Entity.Clone`) when a scene has State Sets. So `sv_saveSelection` uses holdMaxFile -> delete everything else -> explode groups -> repath/rename/layer/group/pivot to origin -> `saveMaxFile useNewFile:false` -> fetchMaxFile. Replaces the user's Edit > Hold buffer and undo history (said in the dialog)
  - `standvault_harvest.py`: PySide6 dialog (qtmax main window parent); calls the server: `/api/library/name` (live ID), `/reserve` (number per level + package folder `<library>\Zones|Objects\<Type>\<AssetID>\maps`), copies the files `sv_collectFiles` finds (missing ones resolved via mapPaths) into maps, then `sv_saveSelection`, then `/done` (or `/failed`, which frees the number and removes the folder)
  - Server `app/server/library.js`: `assets` + `asset_tags` tables; `/done` writes asset.json and queues a preview: `3dsmaxbatch render-preview.ms -sceneFile <asset>.max -mxsString out:<package>\preview.jpg` (Corona 25 s / 40 passes, light-grey environment, 3/4 camera fitted to renderable geometry; scanline if no Corona); `STANDVAULT_NO_PREVIEW` disables it in tests. Assets link to the stand they came from (source scene path -> source_files)
  - App: Library tabs Stands | Zones | Objects; `pages/AssetLibrary.jsx`, `components/AssetPanel.jsx` (Send to Max, Open Folder, new preview, tags, notes, source stand link)
  - Tested headless on a real Corona stand: 23 objects saved, 26 paths relinked to the package maps, scene restored (201 objects, 18 layers, same file name, original texture paths), source file unchanged, preview rendered in 39 s. `npm test` 20/20

## Step 5 (brought forward) - Database + real stands: BUILT 2026-10-26

Commands (from the standvault folder): `npm run scan` (all four scan steps), `npm run import`, `npm run dev` (server + web app, http://localhost:5173), `npm run backup`.
- Database: Node's built-in `node:sqlite` (not better-sqlite3: no compiler/Python on this PC), FTS5 search. File `D:\StandVault_Library\db\standvault.db`, backups `db\backups\standvault-YYYY-MM-DD.db` (server makes one a day), thumbnails cached in `db\thumbs`
- `app/server/`: `schema.sql`, `db.js`, `import.js` (re-runnable: `scan_*` columns refreshed, user columns only filled when empty), `index.js` (Express on 127.0.0.1:5174; Vite proxies /api), `backup.js`
- Stand ids are a hash of the scan's group key. **Changing the grouping rules after reviews start would orphan review data** - add a migration first
- Approve = PATCH status 'approved': needs width, depth, show, client; assigns the next running number and builds the Asset ID with `config/naming.js`; editing an approved stand's details renames it, keeping its number
- Web app is stands-only now: Library (size filter W x D ± tolerance either way round, area bands, show, year, renderer, theme, status, favourites, missing textures, no preview; infinite scroll), stand panel (gallery with "use as cover", editor with live name check, versions with "pick the good one", textures), **Daily review** (`pages/Review.jsx`: one stand at a time, newest first, goal per day, Enter approve / Alt+N not a stand / Alt+S skip), Shortlists, Health Check (size unknown, missing textures, thumbnail only, no preview, duplicate files), Settings (scan folders, add shows/themes - writes config/*.json)
- Mock data, mock previews and the old asset components were removed
- Real data loaded 2026-10-26 (test database deleted first): **1,043 stand projects** from 4,559 stand files; 6,805 scenes in total (1,002 read from inside archives; 1,024 zipped copies of loose files; 53 archives unreadable - 41 would open with 7-Zip, the rest are not archives). Size known from names for 51 stands (5%), show 34%, year 64%, client 98%. Re-import is idempotent (checked)
- 2026-10-26 classification (user asked me to lead, essentials only): **Project type** single choice (taxonomy `projectTypes`: ExhibitionStand, Pavilion, Stage, BrandActivation, Event, Kiosk, Interior; guessed on import from names, `stands.project_type`). Non-show types put `nameWord` in the show's place: `ST_9x4p5_Activation2026_Ford_0001`. Optional one-click labels in `stand_labels` (kind style | spatial | functional | look; lists `styles`, `spatialFeatures`, `zoneTypes` (functional = zone types, so zone harvesting can reuse them), `lookAndFeel`). Theme is replaced by style for stands. Deferred on purpose: height, storeys, rigging, visual polish
- Fixed: saving with empty notes failed (NOT NULL) - notes now saved as ''
- Fixed: Open Folder / version folder icon opened Explorer's default folder for paths with spaces - now `/select,"path"` with `windowsVerbatimArguments`
- **Events have their own form** (user: events have no 10x10 size; classified by kind of event and what they contain): `stands.setting` Indoor | Outdoor | IndoorOutdoor (taxonomy `settings`) replaces the size in the name when no size is given (`ST_Outdoor_UAENationalDay2025_Bloom_0002`; naming.js accepts a setting word in the size slot, tests 9/9); the show field is "Event / occasion"; labels `eventCategory` (taxonomy `eventCategories`: MICE, Celebration, SpecialOccasion, ProductLaunch, GalaAwards, Festival, Corporate) and `eventElement` (`eventElements`: Stage, Seating, PreFunction, Activations, InteractiveWall, PhotoWall, MediaWall, Reception, Kiosks, Games, EntranceArch) + style + look; spatial labels and open sides hidden
- Added **venue** (`stands.venue`, free text, suggestions = venues used + `taxonomy.venues`), for all project types; searchable, Library filter; guessed on import only from explicit words in names (not from the show). Not part of the Asset ID. Later idea: link to the venue models in `D:\Work\Library\08_VENUE-REFERENCE` (DWTC halls etc.)
- Next: the user starts the daily review; collect their comments on the app before Step 6 (3ds Max tools)

## Step 3 - Front end (mock data): DONE, then replaced by the real-data app above

- `npm run dev` (from the project root, or inside `app/`) -> http://localhost:5173. React 19 + Vite 8 + Tailwind 4 (`@tailwindcss/vite`) + lucide-react + Inter (`@fontsource-variable/inter`, offline)
- `app/vite.config.js`: `css.postcss = {}` stops Vite picking up the PulseFit `postcss.config.js` (Tailwind 3) in the parent folder; `server.fs.allow ['..']` lets the app import `config/`
- `config/naming.js` now imports `taxonomy.json` with `with { type: 'json' }` (no Node-only imports), so the app uses the exact same rules and taxonomy; `loadTaxonomy()` takes no path any more
- `app/src/data/mockAssets.js`: 61 deterministic mock assets (13 stands, 24 zones, 24 objects) shaped like inventory.json + asset.json, named after the user's real projects. Placeholder previews are drawn in `components/Preview.jsx` (theme gradient + type icon); swap for real images in Step 5
- State in `app/src/state/store.jsx`: user edits, favourites, shortlists, settings and added types/themes persist in localStorage (`sv.*` keys) until the database step. Health rules (`healthIssues`) live there too
- Screens: `pages/Library.jsx` (level tabs, search, filters, sort, size slider, keyboard `/` F arrows Enter), `components/DetailPanel.jsx` (slide-in; edit type/theme/descriptor with live Asset ID validation), `pages/Shortlists.jsx` (CSV export, print sheet), `pages/HealthCheck.jsx`, `pages/Settings.jsx`. Hash routes `#/library` etc.
- Checked in headless Chrome (playwright-core driving installed Chrome, script kept outside the project): all screens, keyboard, favourite, shortlist add, empty state, print view, light mode, 1280px width - no console errors

## Environment notes

- Windows 11, PowerShell 5.1. Node 24 is installed. **Python is not installed. Git is not installed** (needed in Step 9)
- 3ds Max 2026 with `3dsmaxbatch.exe` is installed (not needed so far; the scan reads files directly)
- Drives: C: (system), D: (scanned), E: (2.9 TB, not scanned yet - the user's other models are probably there)

## Next steps

6 (rest: Save to Library), 7 Smart search (AI), 8 Full testing, 9 GitHub - prompts are in the spreadsheet. (4 Testing was folded into a light `npm test` at the start of Step 6.)
