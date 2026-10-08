// Legacy command now uses the non-destructive merge.
const source=process.argv[2];
if(!source)throw Error('Usage: node scripts/import-sheet.cjs path/to/sheet-export.json');
process.argv=[process.argv[0],process.argv[1],'--source',source,'--write'];
require('./sync-sheet.cjs');
