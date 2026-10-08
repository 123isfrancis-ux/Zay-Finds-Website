# Zay Finds Website

A mobile-friendly product catalogue adapted from the supplied `pbjfinds-main` folder. Branding uses the brown (#584943), cream (#f9eed9), and tan (#b89c84) colors and bold headings in Zay's spreadsheet.

## Run

Use Node.js 20 or newer and pnpm.

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm test
pnpm build
pnpm start
```

Stop the development server before building: both use `.next/`.

## Catalogue

Source: https://docs.google.com/spreadsheets/d/1ISOjOe2mWaPv1ko9OfpEc40M1VwHvYtOebb86HrImQY/edit

The initial import contains 3,755 distinct listings from all 17 tabs. Exact repeated name/link/CNY/USD combinations share one card and retain all collection memberships. Different names or prices remain separate. Product order follows the sheet. Each listing records its original sheet ID and row.

`data/catalogue.json` is a dated snapshot served independently of Google availability. The optional scheduled sync is documented in [SHEET-SYNC.md](SHEET-SYNC.md). The import date is recorded in the data file. No Google credentials or environment variables are required to run it. Google Sheets' regular CSV export is insufficient: it loses embedded hyperlinks, images, and formula detail.

To refresh, obtain an authorized Google Sheets API `spreadsheets.get` JSON response containing `sheets.properties` and `sheets.data.rowData.values` with `formattedValue`, `effectiveValue`, `userEnteredValue`, `hyperlink`, and `textFormatRuns`. Then run:

```sh
pnpm import:sheet /path/to/sheet-export.json
pnpm test
pnpm build
```

Commit the updated snapshot and redeploy to publish the update. This tool never edits the source spreadsheet. The legacy import command now uses the same non-destructive baseline merge as the scheduled sync. See SHEET-SYNC.md for activation and recovery.

## Images

Product photos load directly from Weidian's public image CDN. The lookup in `data/weidian-images.json` maps each exact Weidian item ID to the main product image exposed by that listing. It does not download or rehost photos, modify purchase links, or extract restricted Google images. Multiple cards for the same item ID share that listing's main image; selecting a specific SKU/variant photo is not inferred.

Refresh missing image links with:

```sh
pnpm refresh:images
```

Each run checks at most three public listings sequentially, with 20 seconds between requests. A persistent lock prevents overlap. Connection failures stop the batch and trigger a one-hour cooldown, doubling to a maximum of 24 hours on repeated failures; Retry-After is respected. Authentication failures or access challenges pause collection for manual review. Missing listings get at most three attempts and rotate behind unchecked products. Successful links are checkpointed after every request. Local scheduler state is excluded from Git. `data/weidian-image-report.json` records results. Non-Weidian and unavailable listings may require another image source.

## Prices and links

CNY and USD values are preserved as calculated by the spreadsheet. EUR and GBP are available when present in the row; missing values say “See item price.” No guessed exchange rates are used. Price sorting uses USD and labels that explicitly. Prices, availability, and purchase destinations must be confirmed at the seller.

All product URLs and affiliate parameters are preserved exactly from the source. The signup link and buying tutorial also come from the source sheet. PBJ's profiles, referral link, and social preview image have been removed. Product links are checked for HTTP/HTTPS protocols during import; external destinations are not crawled or validated by the importer.

## Features

- Global search across names and collection memberships
- Seventeen collection filters in spreadsheet-tab order, price/name sorting, and 60-card progressive loading
- Saved items stored locally in the visitor's browser
- Responsive category dialog, keyboard focus states, reduced motion, device dark mode
- Source spreadsheet link and buying tutorial

The original source folder in Downloads is unchanged. Next.js is updated from 14.2.3 to 14.2.35 within its existing major version. The app retains Pages Router and plain image elements, avoiding image-transformation billing for thousands of catalogue images.

## Analytics

Vercel Web Analytics is mounted once in `pages/_app.js` using `@vercel/analytics/next`. The existing custom events are `product_click` (product ID and category), `signup_click` (placement), `tutorial_click`, `save_toggle` (product ID), and `search_results` / `search_empty` (view/category scope and result count). Search text is not sent. No additional analytics provider is configured.

These events measure interactions on Zay Finds. An outgoing product or signup click does not establish a completed purchase or registration on Kakobuy. Purchase attribution and commission must be reconciled with the agent's affiliate reports; this website does not receive checkout confirmations.

Web Analytics must be enabled for the current Vercel project. Custom-event reporting requires an eligible Pro or Enterprise plan according to [Vercel's custom-event documentation](https://vercel.com/docs/analytics/custom-events). Verify collection in the project's Events panel before treating the handlers as measured conversions. The handlers keep navigation working if tracking is unavailable. Do not change the billing plan or add another tracking provider as part of routine catalogue maintenance.

Search collapses line breaks and repeated whitespace in the search index and query, while preserving original product names, links, IDs, prices and collection memberships.
