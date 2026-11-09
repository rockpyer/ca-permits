# CLAUDE.md

## Writing style for titles, headings, and UI copy

Use plain, descriptive titles. Name what the thing shows; don't sell it.

- Chart titles state the measure, scope, and period: "New Drill permits by field, 2026 YTD", "Weekly approved permits by work activity", "Kern New Drill permits vs. SB 237 annual cap".
- Page and section headings are nouns or noun phrases: "California well permit activity", "Operators", "Fields", "Permit records".
- Findings go in body text or captions as plain factual sentences with numbers, never as the page headline.

Never write:

- Marketing or "hero" headlines ("Where the new wells are going", "Permits aren't the bottleneck").
- "It's not X, it's Y" / "X isn't the story, Y is" constructions.
- Buzzy or clever section titles ("Permit pulse", "The read-through", "What changed", "Three takeaways", "Your watchlist").
- Rhetorical questions, teaser phrasing, or exclamation in headings.

When unsure, choose the title a USGS, EIA, or CalGEM report would use.

## Previews for the owner

The owner reviews changes by clicking a preview, not by reading diffs. Give one for every change to `frontend/`, and put the link at the top of the PR body and of the reply.

- The "Deploying Preview to Cloudflare" comment on PRs is the **API Worker** (`worker/`), not the site. Its URL redirects to the live permits.ryweller.com, so never offer it as a preview of a page change.
- The site is on GitHub Pages, which has no per-branch previews. Build a hash-routed preview and publish it as a private claude.ai artifact:
  `cd frontend && npm run snapshot && VITE_PREVIEW=1 npx vite build --base ./ --outDir <scratch dir>`, then publish its `index.html` with the other files (skip `CNAME`, `admin/`, `social-*.png`).
- Link the state page that changed: `<artifact url>#/co`, `#/wy`, `#/drilling`. Republish the same file path to keep the URL across pushes.
