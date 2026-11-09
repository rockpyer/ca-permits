-- One weekly email per state (src/lists.mjs): ca, co, wy. A subscriber row is now one address on one state's list, so
-- the same address can be on several lists, each with its own consent record, confirmation and unsubscribe link.
-- Existing rows are the California list. SQLite cannot change a UNIQUE constraint in place, so both tables are rebuilt.
-- Apply once (D1 console, or npx wrangler d1 execute ca-permits --remote --file migrations/0004_state_lists.sql),
-- before deploying the Worker that reads the list column.

CREATE TABLE subscribers_new (
  id TEXT PRIMARY KEY,
  list TEXT NOT NULL DEFAULT 'ca',        -- ca, co, wy
  email TEXT NOT NULL COLLATE NOCASE,
  email_hash TEXT NOT NULL,
  name TEXT,
  interests TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  consent_at TEXT NOT NULL,
  consent_version TEXT NOT NULL,
  consent_source TEXT,
  country TEXT, region_code TEXT,
  confirm_hash TEXT,
  confirm_expires TEXT,
  confirmed_at TEXT,
  unsubscribed_at TEXT,
  last_sent_at TEXT,
  sends INTEGER NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  UNIQUE (email, list)
);
INSERT INTO subscribers_new (id, list, email, email_hash, name, interests, status, created_at, consent_at, consent_version, consent_source,
  country, region_code, confirm_hash, confirm_expires, confirmed_at, unsubscribed_at, last_sent_at, sends, notes)
  SELECT id, 'ca', email, email_hash, name, interests, status, created_at, consent_at, consent_version, consent_source,
  country, region_code, confirm_hash, confirm_expires, confirmed_at, unsubscribed_at, last_sent_at, sends, notes FROM subscribers;
DROP TABLE subscribers;
ALTER TABLE subscribers_new RENAME TO subscribers;
CREATE INDEX IF NOT EXISTS subscribers_status ON subscribers (list, status);

-- One row per state per weekly email.
CREATE TABLE digests_new (
  list TEXT NOT NULL DEFAULT 'ca',
  week TEXT NOT NULL,
  data_generated_at TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  recipients INTEGER NOT NULL DEFAULT 0,
  sent INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (list, week)
);
INSERT INTO digests_new (list, week, data_generated_at, started_at, finished_at, recipients, sent, failed)
  SELECT 'ca', week, data_generated_at, started_at, finished_at, recipients, sent, failed FROM digests;
DROP TABLE digests;
ALTER TABLE digests_new RENAME TO digests;
-- sends stays keyed by (week, subscriber_id): a subscriber row belongs to one list, so the week is unambiguous.
