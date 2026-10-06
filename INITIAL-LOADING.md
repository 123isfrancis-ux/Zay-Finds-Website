# Prepared first products

The home page uses getServerSideProps with public CDN caching for 300 seconds and a 60-second stale-while-revalidate window. Refreshes are demand-driven on Vercel, not scheduled AI work. A new deployment invalidates the previous deployment's page cache. Query URLs have separate cached responses so audience, category and collection links render their requested selection.

Only the first 24 catalogue cards and the existing shelf previews are serialized, together with category names, counts and the public ranking snapshot. No cookies, saved lists or private dashboard data enter the shared response. Saved and outfit views retain their existing client loading flow.

The full compact catalogue loads after hydration using the same ranking snapshot, preserving the initial order. Remembered audience/currency preferences are restored on the device; if they differ from the public preview, the existing loading state appears until the full catalogue is ready. A failed background request keeps a matching preview and offers retry. A server preparation error falls back to the original client loader. Ranking lookup is bounded to 500ms; unavailable rankings use sheet order for that visit.

Verify raw HTML includes product cards and priority image URLs, CDN cache reports HIT on repeat requests, and mobile filters, Quick View, Saved and Load More continue working. Lighthouse scores must be measured separately; server rendering alone does not guarantee a score.
