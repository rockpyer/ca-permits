-- permits.ryweller.com subscriber list, visit analytics and audit trail. Apply once (D1 console, or
-- npx wrangler d1 execute ca-permits --remote --file migrations/0001_init.sql).
-- Privacy rules: no raw IP address is ever stored (only salted HMACs), and the audit log refers to people by an HMAC of
-- their email, so erasing a subscriber removes them everywhere while the log of what happened stays intact.

-- Weekly-update subscribers. status: pending (waiting for the confirmation click), active, unsubscribed.
-- consent_* is the record of what they agreed to and where: the form's consent wording version and page.
CREATE TABLE IF NOT EXISTS subscribers (
  id TEXT PRIMARY KEY,                    -- random, used in links instead of the email
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  email_hash TEXT NOT NULL,               -- HMAC of the email, the key used in audit_log
  name TEXT,
  interests TEXT NOT NULL DEFAULT '[]',   -- JSON list, e.g. ["kern","new-drill"]
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  consent_at TEXT NOT NULL,
  consent_version TEXT NOT NULL,
  consent_source TEXT,                    -- page path the form was on
  country TEXT, region_code TEXT,
  confirm_hash TEXT,                      -- SHA-256 of the one-time confirmation token
  confirm_expires TEXT,
  confirmed_at TEXT,
  unsubscribed_at TEXT,
  last_sent_at TEXT,
  sends INTEGER NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS subscribers_status ON subscribers (status);

-- One row per weekly digest: the week it covers, when it went out and how many it reached.
CREATE TABLE IF NOT EXISTS digests (
  week TEXT PRIMARY KEY,                  -- last day the digest covers, YYYY-MM-DD
  data_generated_at TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  recipients INTEGER NOT NULL DEFAULT 0,
  sent INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0
);
-- Per-recipient delivery record, so a retried run never sends anyone the same week twice.
CREATE TABLE IF NOT EXISTS sends (
  week TEXT NOT NULL,
  subscriber_id TEXT NOT NULL,
  at TEXT NOT NULL,
  status TEXT NOT NULL,                   -- sent, failed
  provider_id TEXT,
  error TEXT,
  PRIMARY KEY (week, subscriber_id)
);

-- Append-only trail of every change to the list and every admin action. actor: 'public', 'system' or the admin name.
-- subject is an email HMAC (or another non-personal key). Nothing in the API updates or deletes these rows.
CREATE TABLE IF NOT EXISTS audit_log (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  subject TEXT,
  detail TEXT NOT NULL DEFAULT '{}',
  ip_hash TEXT
);
CREATE INDEX IF NOT EXISTS audit_at ON audit_log (at);

-- Admin sessions (cookie token stored only as a hash) and the sign-in / sign-up throttles (address only as a hash).
CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, username TEXT NOT NULL, expires_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS throttle (kind TEXT NOT NULL, who TEXT NOT NULL, at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS throttle_who ON throttle (kind, who, at);

-- Anonymous visits: one row per page load, updated while the page stays open. Region and network owner come from
-- Cloudflare; no address is kept. vid is a random id the browser keeps, to count returning visitors.
CREATE TABLE IF NOT EXISTS visits (
  id TEXT PRIMARY KEY, vid TEXT NOT NULL, started_at TEXT NOT NULL, last_at TEXT NOT NULL,
  path TEXT NOT NULL, referrer TEXT, utm TEXT, country TEXT, region TEXT, region_code TEXT, city TEXT, org TEXT,
  mobile INTEGER NOT NULL DEFAULT 0, seconds INTEGER NOT NULL DEFAULT 0, clicks INTEGER NOT NULL DEFAULT 0,
  events TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS visits_started ON visits (started_at);
CREATE INDEX IF NOT EXISTS visits_vid ON visits (vid);
-- The owner's browsers (visitor id) and networks (address HMAC), recorded while signed in; their visits are not counted.
CREATE TABLE IF NOT EXISTS owner_marks (kind TEXT NOT NULL, hash TEXT NOT NULL, at TEXT NOT NULL, PRIMARY KEY (kind, hash));
