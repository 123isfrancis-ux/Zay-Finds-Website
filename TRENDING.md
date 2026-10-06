# Demand ranking

Production opt-in: `TRENDING_ENABLED=1` and a connected Upstash Redis REST database (`KV_REST_API_URL` / `KV_REST_API_TOKEN`, or `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`). Keep credentials server-only. Set the flag to `0` and redeploy to disable. Preview builds have no production database connection.

The current free database is `zay-finds-trending` in the ZWay Vercel account, connected to the production `zway-finds-website` project. Free plan: 500,000 monthly commands as shown during setup. No paid upgrade was selected. If storage is unavailable or reaches a limit, browsing falls back to sheet order.

## What counts

A product exposure requires at least half of its card on screen for one second in a visible tab. Clicking its seller link or adding it to Saved also implies an exposure. Removing a save is not a positive event. One exposure, click, and save per product per browser per UTC day count; a daily random browser identifier is stored locally and hashed server-side. No names, email addresses, arbitrary search text, or raw IP addresses are stored in the database. The owner insights extension records only catalogue-vocabulary search misses and grouped other queries; see INSIGHTS.md. IP-derived rate-limit hashes expire in one minute. Browser Do Not Track / Global Privacy Control are respected by this collector. Existing Vercel Analytics is independent.

POST events validate origin, product IDs against visible catalogue entries, types, and batch size. Atomic Redis writes prevent double-counting concurrent events. There is a per-address request limit and a per-browser event bound. These are basic abuse controls, not bot-proof identity verification. Aggregates expire after nine days; deduplication records after two days.

## Ranking

Seven UTC daily buckets, with a three-day half-life. Eligibility requires 30 exposures and five click/save actions over the window. Saves carry twice the click weight. A smoothed engagement rate prevents tiny samples from dominating. At least three eligible products are needed before the sort is labelled Trending. Until then the default label is Recommended and uses existing sheet order; no fake popularity is displayed.

With data, four out of five slots use descending scores; the fifth gives an unranked product with a photo exposure. Discovery order is deterministic per day. Categories without any scored products preserve sheet order. Existing audience, search, category, visibility, currency and explicit sort controls apply; Saved keeps its established ordering. Rankings are fetched once per page load and never reshuffle as events arrive. The server caches scores for five minutes. The client caps the ranking lookup at two seconds and falls back cleanly.

## Validation

Run `node --test tests/*.test.cjs` and `node node_modules/next/dist/bin/next build`. Test live Redis logic using a separate `zay:trending:verify:<random>` prefix, never seed fake popularity into `zay:trending:v1`. Verification records must have short expiry. The owner dashboard and its additional signals are documented in INSIGHTS.md.
