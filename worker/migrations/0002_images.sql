-- Each week's email map (PNG), copied from the site when that week's email is built, so an email opened later still
-- shows its own week. Served at /img/<key>. Apply once (D1 console).
CREATE TABLE IF NOT EXISTS images (key TEXT PRIMARY KEY, type TEXT NOT NULL, data BLOB NOT NULL, created_at TEXT NOT NULL);
