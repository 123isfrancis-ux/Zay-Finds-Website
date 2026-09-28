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

`data/catalogue.json` is a dated snapshot, not an automatic live connection. The import date is recorded in the data file. No Google credentials or environment variables are required to run it. Google Sheets' regular CSV export is insufficient: it loses embedded hyperlinks, images, and formula detail.

To refresh, obtain an authorized Google Sheets API `spreadsheets.get` JSON response containing `sheets.properties` and `sheets.data.rowData.values` with `formattedValue`, `effectiveValue`, `userEnteredValue`, `hyperlink`, and `textFormatRuns`. Then run:

```sh
pnpm import:sheet /path/to/sheet-export.json
pnpm test
pnpm build
```

Commit the updated snapshot and redeploy to publish the update. This tool never edits the source spreadsheet. A separate authenticated refresh process would be needed for automatic syncing.

## Images

Product photos load directly from Weidian's public image CDN. The lookup in `data/weidian-images.json` maps each exact Weidian item ID to the main product image exposed by that listing. It does not download or rehost photos, modify purchase links, or extract restricted Google images. Multiple cards for the same item ID share that listing's main image; selecting a specific SKU/variant photo is not inferred.

Refresh missing image links with:

```sh
pnpm refresh:images
```

The script checks one public listing at a time by default, checkpoints every 50, skips successful cached entries, and stops on authentication/rate-limit challenges or three consecutive connection failures. Unavailable listings and non-Weidian destinations retain their existing image or placeholder. `data/weidian-image-report.json` records the latest run. Refresh again after the source catalogue changes, then rebuild and redeploy. Photo links are seller-controlled and may change later.

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

Vercel Web Analytics is mounted once in `pages/_app.js` using `@vercel/analytics/next`. Enable Web Analytics in the Vercel project dashboard and deploy this commit to collect page views. No custom events or additional analytics provider are configured.
