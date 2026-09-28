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

Two product rows expose an `IMAGE` formula and are included. Most product photos are embedded objects that the Sheets cell API did not expose. The connected Google Drive account refused the Excel download, so these cannot yet be extracted. Attach an authorized Excel download of the original spreadsheet to recover images and their row anchors. Missing images deliberately show a Zay placeholder with a link to seller photos; no substitute product images are invented.

## Prices and links

CNY and USD values are preserved as calculated by the spreadsheet. EUR and GBP are available when present in the row; missing values say “See item price.” No guessed exchange rates are used. Price sorting uses USD and labels that explicitly. Prices, availability, and purchase destinations must be confirmed at the seller.

All product URLs and affiliate parameters are preserved exactly from the source. The signup link and buying tutorial also come from the source sheet. PBJ's profiles, referral link, analytics, and social preview image have been removed. Product links are checked for HTTP/HTTPS protocols during import; external destinations are not crawled or validated by the importer.

## Features

- Global search across names and collection memberships
- Seventeen collection filters, price/name sorting, and 60-card progressive loading
- Saved items stored locally in the visitor's browser
- Responsive category dialog, keyboard focus states, reduced motion, device dark mode
- Source spreadsheet link and buying tutorial

The original source folder in Downloads is unchanged. Next.js is updated from 14.2.3 to 14.2.35 within its existing major version. The app retains Pages Router and plain image elements, avoiding image-transformation billing for thousands of catalogue images.
