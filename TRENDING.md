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

## Adaptive Recommended ordering

Recommended uses a separate click-rate model; Trending eligibility and its click/save scores remain available. Products are grouped by recognizable product type (watches, shoes, bags, bottoms, tops, dresses, accessories), with specific catalogue categories as fallback. Generic Main/TikTok/Taobao sections are not comparison groups. Unclassified products stay eligible for discovery rather than being judged against unrelated products.

A product needs 100 raw views within seven UTC dates. A comparison group needs at least three such photographed, visible products, 100 recency-weighted views and five weighted clicks. Click rates use the existing three-day half-life and 50 baseline-weighted pseudo-views to dampen small samples. Eligible products rank by rate relative to their group; rates below 60% of the group baseline move behind discovery products. They are not deleted and can recover as their recent results change or old evidence expires.

Four positions favor measured performers and every fifth offers an unjudged photographed product; after performers are exhausted, remaining discoveries follow, then low performers and unphotographed items. Discovery order rotates deterministically daily. With no eligible evidence in the filtered results, sheet order remains. Scores are computed using the existing seven Redis buckets and five-minute server cache, with no additional database reads or new tracking. Each page load fetches one snapshot: an open page never reshuffles as new events arrive.

Adaptive ordering applies to default Recommended catalogue browsing and the already-proven Trending shelf. Just Added, budget collection order, manual price sorts, Saved, and curated fits preserve their own ordering. The model measures seller clicks, not confirmed purchases. No paid services or scheduled tasks are required.
