// Import an authorized Google Sheets CellData JSON export, preserving hyperlinks and numeric values.
const fs = require('node:fs');
const path = require('node:path');
const { importSheet } = require('../lib/google-sheet');
const source = process.argv[2];
if (!source) throw new Error('Usage: node scripts/import-sheet.cjs path/to/sheet-export.json');
const workbook = JSON.parse(fs.readFileSync(source, 'utf8'));
const output = importSheet(workbook, workbook.importedAt);
if (!output.items.length) throw new Error('No product rows found; existing catalogue was not changed.');
fs.writeFileSync(path.join(__dirname, '../data/catalogue.json'), JSON.stringify(output));
console.log(`${output.items.length} listings imported across ${output.collections.length} collections; ${output.items.filter(item => item.image).length} image URLs.`);
