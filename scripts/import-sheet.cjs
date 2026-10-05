// Import an authorized Google Sheets CellData JSON export, preserving hyperlinks and numeric values.
const fs = require('node:fs');
const path = require('node:path');
const { recordAddedDates } = require('../lib/home-collections');
const { importSheet } = require('../lib/google-sheet');
const source = process.argv[2];
if (!source) throw new Error('Usage: node scripts/import-sheet.cjs path/to/sheet-export.json');
const workbook = JSON.parse(fs.readFileSync(source, 'utf8'));
const output = importSheet(workbook, workbook.importedAt);
if (!output.items.length) throw new Error('No product rows found; existing catalogue was not changed.');
const target = path.join(__dirname, '../data/catalogue.json');
const datesFile = path.join(__dirname, '../data/product-added-at.json');
const previous = JSON.parse(fs.readFileSync(target, 'utf8'));
const dates = JSON.parse(fs.readFileSync(datesFile, 'utf8'));
const updated = recordAddedDates(previous.items, output.items, dates, new Date().toISOString());
fs.writeFileSync(datesFile, JSON.stringify(updated, null, 2) + '\n');
fs.writeFileSync(target, JSON.stringify(output));
console.log(`${output.items.length} listings imported across ${output.collections.length} collections; ${output.items.filter(item => item.image).length} image URLs.`);
