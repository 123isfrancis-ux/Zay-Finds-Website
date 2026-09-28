# Project guidance

Read README.md for data provenance, known image limitations, and commands. This is a Next.js Pages Router site adapted from a user-supplied PBJ source folder.

Do not change affiliate codes or replace purchase URLs. Keep numeric sheet prices, sheet order, and all collection memberships. Preserve defensive localStorage parsing. Never add invented product photos or demo listings. The Google spreadsheet is a read-only source.

Data import: lib/google-sheet.js and scripts/import-sheet.cjs. API: lib/regional-catalogue.js. UI: pages/index.js. Styling: styles/globals.css. All catalogue data is currently an explicitly dated local snapshot.

Run pnpm test and pnpm build after changes. Do not run dev and build simultaneously.
