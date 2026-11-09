-- The owner's changes on the admin page's Backlog tab: one row per item id from src/backlog.mjs. status and priority
-- override the item's defaults when set; notes are free text. The items themselves live in code. Apply once (D1 console).
CREATE TABLE IF NOT EXISTS backlog_state (id TEXT PRIMARY KEY, status TEXT, priority TEXT, notes TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL);
