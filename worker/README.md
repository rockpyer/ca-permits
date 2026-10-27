# permits-api: email list, visitor analytics, admin

A Cloudflare Worker beside the static site. permits.ryweller.com stays on GitHub Pages; this Worker runs at
`permits-api.ryweller.com` and holds everything that needs a server:

| Path | What |
|---|---|
| `POST /api/subscribe` | Sign-up form (called by the site, CORS-limited to `ALLOWED_ORIGINS`) |
| `POST /api/visit` | Anonymous visit beacon (`frontend/src/lib/visits.ts`) |
| `/confirm`, `/unsubscribe` | Links in emails (GET shows a button, POST acts; POST is also RFC 8058 one-click) |
| `/admin` | Admin page, signed in as **Neptune** |
| cron, Mondays 17:23 UTC | Weekly digest to active subscribers |

Storage is the D1 database `ca-permits` (`fa528a5c-…`, schema in `migrations/`, already applied). Email goes through
[Resend](https://resend.com/docs/api-reference/emails/send-batch-emails).

## Sign-up API (for the form)

```http
POST https://permits-api.ryweller.com/api/subscribe
Content-Type: application/json

{ "email": "pat@operator.com", "name": "Pat", "interests": ["kern"], "source": "/drilling", "consent": true, "website": "" }
```

- `consent` must be `true`, from an unchecked-by-default checkbox labeled with `CONSENT_TEXT` in `src/subscribe.mjs`
  ("Email me a weekly summary of California permit activity. Unsubscribe anytime."). If the wording changes, bump
  `CONSENT_VERSION` so each subscriber's record shows what they agreed to.
- `website` is a honeypot: render it hidden (`tabindex="-1" autocomplete="off"`, off-screen). Bots that fill it are dropped.
- `name`, `interests` (up to 10 slugs, `a-z0-9-`) and `source` (the page path) are optional.
- Answers `{ ok: true }` for every well-formed request, including addresses already on the list, so the form never reveals
  who subscribed. Show "Check your inbox to confirm." Errors: `422 { ok: false, field, error }` (show `error` next to
  `field`), `429` (rate limit, 10 sign-ups an hour per network).

## Security and record-keeping

- **Double opt-in.** Nobody gets the digest until they click the confirmation link. The admin cannot mark anyone active.
- **Consent record** per subscriber: when, which wording version, which page, region.
- **Append-only audit log** (`audit_log`) of every sign-up, confirmation, unsubscribe, sign-in, export, erase and send.
  People appear only as an HMAC of their email, so erasing someone leaves the log intact without their address.
- **No IP addresses stored** anywhere: rate limits and owner-exclusion use salted hashes.
- **Admin:** PBKDF2 password hash (secret), HttpOnly/Secure/SameSite=Strict session cookie stored hashed, 10 failed
  sign-ins per 15 minutes, custom-header CSRF guard, strict CSP on `/admin`.
- **Recovery:** D1 Time Travel restores the database to any minute in the last 30 days.
- **Deliverability/compliance:** List-Unsubscribe + one-click headers ([Gmail/Yahoo bulk-sender rules](https://support.google.com/a/answer/81126)),
  postal address in every email ([CAN-SPAM](https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business)).
  CSV exports defuse spreadsheet formulas.

## Setup (one time)

1. **Resend.** Uses the already-verified `ryweller.com` domain (sender `updates@ryweller.com`). **API Keys → Create API
   key**, name `ca-permits`, permission *Sending access*, domain `ryweller.com`. A key of its own can be revoked without
   touching anything else. Free plan: 3,000 emails a month, 100 a day.
2. **Deploy the Worker.** Cloudflare dashboard (account `b04dc71e…`, the one with `weller-logs`) → **Workers & Pages →
   Create → Import a repository** → `rockpyer/ca-permits`, **Root directory** `worker`, production branch `main`.
   Workers Builds then deploys on every push to `main` and attaches `permits-api.ryweller.com`.
3. **Secrets.** Worker → **Settings → Variables and Secrets → Add** (type *Secret*):
   - `ADMIN_PW`: hash of the Neptune password (`node scripts/hash-password.mjs 'password'`, or ask Claude to make it).
   - `SIGNING_KEY`: a long random string. Never change it: it signs every unsubscribe link already sent.
   - `RESEND_API_KEY`: from step 1. Until it is set, emails are logged instead of sent (the admin page says "dry run").
4. **Postal address.** Set `POSTAL_ADDRESS` in `wrangler.jsonc` (a PO box or virtual mailbox is fine).
5. Open `https://permits-api.ryweller.com/admin`, sign in as Neptune, and send yourself a test from **Weekly email**.

## Develop

`npm test` runs the API tests on a SQLite stand-in for D1 (Node 22+). `node scripts/hash-password.mjs 'pw'` prints an
`ADMIN_PW` hash.
