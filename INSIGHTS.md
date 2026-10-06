# Private owner insights

`/insights` is an unlinked, noindex login page. `/api/dashboard` requires a server-only `DASHBOARD_PASSWORD` of at least 24 characters. Configure a unique password-manager-generated password as a Secret in the main Vercel project's Production environment, then redeploy. Never use NEXT_PUBLIC or commit the password. Missing configuration fails closed. Preview deployments and the secondary Vercel project stay locked unless configured separately.

The browser keeps the password only in component memory, sends it in an Authorization header over HTTPS, and clears it on lock or reload. Do not share it in URLs. Rate-limited failures use hashed IP-derived keys expiring after 15 minutes. Rotate the environment variable and redeploy to revoke the old password. The data endpoint is always private/no-store; no metrics are embedded in the public page or build. Counts are cached server-side for one minute only after authentication.

Reports use seven UTC dates including today from the existing free Redis database. Counts are daily browser-product events, not sales or unique people. Low engagement requires 30 views and below 5% seller click rate. Only real events appear; no synthetic production data is used.

New search/photo signals begin with this deployment and expire after nine days. Photo errors are reports, not proof a seller listing is permanently broken. Unsuccessful search terms are normalized only if all words occur in catalogue titles; unfamiliar queries, contact-like text and URLs are grouped as Other searches. Raw search text is not retained in storage. Signals respect Do Not Track/GPC and the existing collection enable flag, validate origins and IDs, and apply short-lived address limits plus daily session deduplication. No new paid service is used.

Test with `node --test tests/*.test.cjs` and Next's production build. Do not add verification clicks to production counters. A user must enter their private password themselves for the final authenticated browser check.
