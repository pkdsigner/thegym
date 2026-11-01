-- StandVault database. Lives in <library>/db/standvault.db.
-- Columns starting with scan_ are refreshed by every import; everything else is the user's and is never
-- overwritten by an import (only filled in the first time a stand appears).

CREATE TABLE IF NOT EXISTS stands (
  id                TEXT PRIMARY KEY,           -- stable id from the scan (one per project)
  asset_id          TEXT UNIQUE,                -- ST_10x10_GITEX2025_DEWA_0007, set when approved
  number            INTEGER UNIQUE,             -- running number, set when approved
  status            TEXT NOT NULL DEFAULT 'unreviewed', -- unreviewed | approved | not_stand
  title             TEXT,
  client            TEXT,
  show              TEXT,
  year              INTEGER,
  width             REAL,
  depth             REAL,
  area              REAL,
  size_source       TEXT,                       -- 'name' (read from a file/folder name) | 'user'
  open_sides        TEXT,                       -- Inline | Corner | Peninsula | Island
  project_type      TEXT,                       -- taxonomy.projectTypes code, e.g. ExhibitionStand, BrandActivation
  venue             TEXT,                       -- where it was built, e.g. DWTC, ADNEC, Dubai Mall (free text)
  setting           TEXT,                       -- events: Indoor | Outdoor | IndoorOutdoor (used in the name when there's no size)
  type_confirmed_at TEXT,                       -- set by Quick sort (or approving): the project type was checked by the user
  theme             TEXT,                       -- no longer used (replaced by style labels); kept for old databases
  best_file_id      TEXT,                       -- the version the user picked
  preview_path      TEXT,                       -- the image the user picked
  favourite         INTEGER NOT NULL DEFAULT 0,
  used_count        INTEGER NOT NULL DEFAULT 0,
  notes             TEXT NOT NULL DEFAULT '',
  skipped_at        TEXT,                       -- pushed to the back of the review queue
  reviewed_at       TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  scan_title        TEXT,
  scan_client       TEXT,
  scan_show         TEXT,
  scan_year         INTEGER,
  scan_width        REAL,
  scan_depth        REAL,
  scan_area         REAL,
  scan_size_text    TEXT,
  scan_suggested_id TEXT,
  scan_renderer     TEXT,
  scan_project      TEXT,
  scan_last_modified TEXT,
  scan_versions     INTEGER,
  scan_preview      TEXT,                       -- render | thumbnail | none
  scan_thumbnail    TEXT,
  scan_textures_missing INTEGER,
  scan_textures_total   INTEGER,
  scan_objects      INTEGER,
  scan_seen_at      TEXT                        -- last import that still found this stand
);
CREATE INDEX IF NOT EXISTS stands_status ON stands(status);
CREATE INDEX IF NOT EXISTS stands_area ON stands(area);
CREATE INDEX IF NOT EXISTS stands_size ON stands(width, depth);
CREATE INDEX IF NOT EXISTS stands_show ON stands(show, year);
CREATE INDEX IF NOT EXISTS stands_modified ON stands(scan_last_modified);

-- Every scene file from the inventory. Stand versions have stand_id; everything else is unsorted for later.
CREATE TABLE IF NOT EXISTS source_files (
  file_id           TEXT PRIMARY KEY,
  stand_id          TEXT REFERENCES stands(id),
  path              TEXT NOT NULL UNIQUE,
  name              TEXT NOT NULL,
  folder            TEXT NOT NULL,
  archive           TEXT,
  size_bytes        INTEGER,
  modified          TEXT,
  saved_as_year     INTEGER,
  renderer          TEXT,
  renderer_name     TEXT,
  objects           INTEGER,
  faces             INTEGER,
  materials         INTEGER,
  default_name_pct  INTEGER,
  textures_total    INTEGER,
  textures_missing  INTEGER,
  preview_source    TEXT,
  thumbnail         TEXT,
  likely            TEXT,
  class_reason      TEXT,
  duplicate_of      TEXT,
  scan_seen_at      TEXT
);
CREATE INDEX IF NOT EXISTS source_files_stand ON source_files(stand_id);

CREATE TABLE IF NOT EXISTS renders (
  stand_id  TEXT NOT NULL REFERENCES stands(id),
  path      TEXT NOT NULL,
  position  INTEGER NOT NULL,
  PRIMARY KEY (stand_id, path)
);

CREATE TABLE IF NOT EXISTS textures (
  file_id   TEXT NOT NULL REFERENCES source_files(file_id),
  path      TEXT NOT NULL,
  status    TEXT NOT NULL,                      -- ok | nearby | elsewhere | missing
  reason    TEXT,
  found_at  TEXT
);
CREATE INDEX IF NOT EXISTS textures_file ON textures(file_id);

CREATE TABLE IF NOT EXISTS stand_tags (
  stand_id  TEXT NOT NULL REFERENCES stands(id),
  tag       TEXT NOT NULL,
  PRIMARY KEY (stand_id, tag)
);
CREATE INDEX IF NOT EXISTS stand_tags_tag ON stand_tags(tag);

-- Optional one-click classification, value = a taxonomy code. kind = style | spatial | functional | look,
-- and for events eventCategory | eventElement.
CREATE TABLE IF NOT EXISTS stand_labels (
  stand_id  TEXT NOT NULL REFERENCES stands(id),
  kind      TEXT NOT NULL,
  value     TEXT NOT NULL,
  PRIMARY KEY (stand_id, kind, value)
);
CREATE INDEX IF NOT EXISTS stand_labels_value ON stand_labels(kind, value);

-- Zones and objects harvested with "Save to Library" in 3ds Max. Each is a package folder in the library:
-- <AssetID>.max, maps\, preview.jpg, asset.json.
CREATE TABLE IF NOT EXISTS assets (
  asset_id        TEXT PRIMARY KEY,             -- ZN_Majlis_ArabicTraditional_LowSeatingCurved_0012
  level           TEXT NOT NULL,                -- ZN | OB
  number          INTEGER NOT NULL,             -- running number, unique per level
  type            TEXT NOT NULL,
  theme           TEXT NOT NULL,
  descriptor      TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'saving', -- saving | ready
  package_path    TEXT NOT NULL,
  max_path        TEXT NOT NULL,
  preview_path    TEXT,
  source_scene    TEXT,                         -- the scene it was harvested from (never changed)
  source_stand_id TEXT REFERENCES stands(id),
  renderer        TEXT,
  objects         INTEGER,
  textures_total  INTEGER,
  textures_missing INTEGER,
  favourite       INTEGER NOT NULL DEFAULT 0,
  used_count      INTEGER NOT NULL DEFAULT 0,
  notes           TEXT NOT NULL DEFAULT '',
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  UNIQUE (level, number)
);
CREATE TABLE IF NOT EXISTS asset_tags (
  asset_id  TEXT NOT NULL REFERENCES assets(asset_id) ON DELETE CASCADE,
  tag       TEXT NOT NULL,
  PRIMARY KEY (asset_id, tag)
);

CREATE TABLE IF NOT EXISTS shortlists (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS shortlist_items (
  shortlist_id INTEGER NOT NULL REFERENCES shortlists(id) ON DELETE CASCADE,
  stand_id     TEXT NOT NULL REFERENCES stands(id),
  position     INTEGER NOT NULL,
  PRIMARY KEY (shortlist_id, stand_id)
);

CREATE TABLE IF NOT EXISTS usage_log (
  stand_id     TEXT NOT NULL REFERENCES stands(id),
  project_name TEXT,
  scene_path   TEXT,
  sent_at      TEXT NOT NULL
);

-- Full-text search over what the user types into the search bar.
CREATE VIRTUAL TABLE IF NOT EXISTS stands_fts USING fts5(
  stand_id UNINDEXED, text, tokenize = 'unicode61 remove_diacritics 2'
);

CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
