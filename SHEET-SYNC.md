# Spreadsheet-to-website sync

Source: https://docs.google.com/spreadsheets/d/1ISOjOe2mWaPv1ko9OfpEc40M1VwHvYtOebb86HrImQY/edit

The initial baseline was read on 2026-10-08. It intentionally leaves all existing catalogue records unchanged. Future source changes are merged into the catalogue, rather than replacing it. Website-only products, product IDs, saved items, search aliases, audience overrides, curated outfits, and editorial selections are preserved.

The GitHub workflow checks at minutes 7, 22, 37 and 52 each hour once `SHEET_SYNC_ENABLED=true`. Scheduling is best effort. Updates need the subsequent Vercel build to finish. GitHub disables public-repository schedules after 60 days without repository activity; check the Actions page if updates stop.

## What updates

- New complete products, names, original affiliate URLs, calculated prices rounded to currency cents, IMAGE formula photos, and category memberships from the existing 19 source tabs.
- Existing recovered photos and manual titles stay intact until that field is intentionally changed in the source after the baseline. A changed sheet photo is saved as an explicit image override.
- Product matching uses seller listing IDs or normalized purchase links, never prices or row numbers. A new seller listing ID is a new product. Use Website status to hide its predecessor when replacing a listing. Moving rows cannot rename or replace unrelated products.
- A dedicated column headed `Website status` within A:Z may contain `hide` or `show`. Only items hidden by this sync can be restored with `show`; confirmed dead listings remain hidden. Blank cells and missing rows do not delete products.
- New products get real addition dates. Existing homepage curation and watch ranking remain in place. New tabs require deliberate configuration; arbitrary workbook tabs are not automatically published.

## Validation and recovery

The entire read and merge must succeed before any files are written. Missing configured tabs, a source count drop greater than 20%, over 100 additions, over 50 hides, or a new product without a photo/positive price stop the run. Fragrances are excluded. Malformed listing URLs are counted and skipped. Missing source products remain live until explicitly hidden. Check the run summary for counts; failed runs are visible in GitHub Actions and use the account's normal failure-notification preferences.

The production build must pass before pushing. Non-fast-forward pushes fail safely and the next run rereads current main. No automatic rebases or force pushes. Vercel deployment status is checked after publication. Restore a previous Git commit to roll back catalogue and baseline together.

## Authentication

Use Google Workload Identity Federation, restricted to numeric GitHub repository ID 1391557342, owner ID 334737051, main, and this exact workflow. The service account already has Viewer access to the source spreadsheet and needs no project Editor/Owner role. Tokens request only spreadsheets.readonly. No permanent private key is needed.

Set `SHEETS_WIF_PROVIDER` to the created provider resource path. Keep `SHEET_SYNC_ENABLED` unset until authentication is configured. Enable it, run a manual dry run, inspect the summary, then run with dry_run=false and verify both the action and Vercel.

Local preview: `node scripts/sync-sheet.cjs --source /path/to/authorized-celldata.json`.
Authenticated preview: supply a short-lived `GOOGLE_SHEETS_ACCESS_TOKEN` and run `node scripts/sync-sheet.cjs`.
Adding `--write` saves validated output. Do not recreate the baseline: it distinguishes future source edits from protected website corrections.
