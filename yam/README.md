# YAM — Construction Documentation System (Phase 01, local prototype)

A documentation-first application for YAM's internal team. It centralises every piece of technical information for residential projects: floors, spaces, measurements, finishes, products, quantities, electrical/lighting, furniture/joinery, plumbing, equipment, drawings, schedules and exports.

Plain **HTML5 + CSS3 + vanilla JavaScript (ES modules)**. No framework, no backend. Records live in LocalStorage and files in IndexedDB.

## Get the code

Repository **mmokhtar0203-afk/Operating-system**, branch **`claude/jolly-newton-kr3bqg`**, folder **`yam/`**.

- **Without git:** open https://github.com/mmokhtar0203-afk/Operating-system/tree/claude/jolly-newton-kr3bqg, then **Code → Download ZIP**, and extract it. The app is in `Operating-system-claude-jolly-newton-kr3bqg\yam`.
- **With git:**
  ```
  git clone -b claude/jolly-newton-kr3bqg https://github.com/mmokhtar0203-afk/Operating-system.git
  ```

## Run it

**Windows:** open the `yam` folder and double-click **`start.bat`**. A console window opens and your browser opens at http://localhost:8080. Keep that console window open while you use YAM; close it to stop.
- If Python is installed (`py` or `python`), it uses `serve.py`.
- Without Python, it uses `serve.ps1`, a small server built on Windows PowerShell. No installation is needed.
- If Windows SmartScreen warns about the file, choose **More info → Run anyway**.

**macOS:** double-click `start.command` (first time: right-click → Open). **Linux:** `./start.sh`.

**Any OS, manually:** `python serve.py` from inside `yam/`.

Do not open `index.html` by double-clicking: browsers block the app's JavaScript modules on `file://`, and the page then explains how to start it properly. Use Chrome, Edge, Safari or Firefox (current versions). The app runs entirely offline; only the web fonts need internet, and it falls back to system fonts without it.

On first launch, the app creates demonstration data: **ZED EAST** (villa, Dr. Ahmed Mokhtar), **WESAL RESIDENCE** (apartment) and **ALLEGRIA SUITE** (interior project), plus a 44-item library with generated material swatches and product drawings. Your data is stored in that browser on that computer. Use **Settings → Export full backup** to move it elsewhere.

## Architecture

```
yam/
  index.html                 shell + boot fallback
  assets/css/                base (tokens) · layout · components · pages · print
  assets/js/app.js           bootstrap, routes, sidebar/top bar, global search, re-render
  core/                      router (hash), utils, event bus — no domain knowledge
  storage/                   local-store.js (LocalStorage) · blob-store.js (IndexedDB)
  data/                      models (vocabulary + factories) · templates · seed · textures
  services/                  db.js (the ONLY data-access layer) + domain services:
                             project, template, measurement (formula engine), library,
                             spec (revisions/applications), schedule, completeness,
                             search, file, backup, settings
  components/                modal/confirm/menu/lightbox, toast, icons, ui helpers,
                             files-ui, spec-form (shared editor), assign (space items),
                             project-ui
  pages/                     one module per screen, loaded on demand
  exports/                   room-sheet, material-board, print-kit (pagination,
                             standalone HTML), tabular (CSV / Excel .xls)
```

**Separation:** UI → services → `services/db.js` → `storage/*`. Pages never touch storage. `db.js` keeps a local-first, in-memory cache of every table (`projects, floors, spaces, templates, library, specs, applications, files`) and persists it with a debounced write. A Supabase adapter can later hydrate the same cache and write through on commit, without changing the UI.

**Key data rules**
- *Library item* (`MAT-0001` / `PRD-0001`) holds reusable data. A *project specification* (`ZED-FL-01`) holds a **snapshot** of that data, so later library edits never change it silently. The project is flagged and decides whether to update.
- An *application* links one spec to one space with quantity, unit, optional rate and notes. A quantity can be manual or **linked to a room measurement** (+ waste %). Totals are kept per unit and never mixed.
- *Schedules* are computed from specs + applications on every view and are never stored.
- *Approved spec edited* → the old revision is frozen (data, status, approval evidence, who/when/why) and a new draft revision requires approval.
- *Spaces* get a deep copy of their room template. Template edits bump the version; existing spaces are *offered* new fields and never overwritten.

## Notes
- PDF output uses the browser's print engine ("Print / Save as PDF"). Set margins to **None** and enable **Background graphics**. Each export can also be downloaded as a self-contained HTML file.
- Data lives in this browser profile only. Use **Settings → Export full backup** regularly.
