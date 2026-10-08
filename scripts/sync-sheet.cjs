// Read-only Google Sheets fetch. Output files change only after every validation succeeds.
const fs=require('node:fs');
const path=require('node:path');
const {SHEET_ID}=require('../lib/google-sheet');
const {baseline,mergeSheet}=require('../lib/sheet-sync');
const root=path.resolve(__dirname,'..');
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const args=process.argv.slice(2),arg=name=>args.includes(name)?args[args.indexOf(name)+1]:null;
async function get(url){
  const token=process.env.GOOGLE_SHEETS_ACCESS_TOKEN;
  if(!token)throw Error('Google authentication is not configured');
  for(let attempt=0;attempt<3;attempt++){
    const response=await fetch(url,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(45000)});
    if(response.ok)return response.json();
    if(![429,500,502,503,504].includes(response.status)||attempt===2)throw Error(`Google Sheets read failed (${response.status}); catalogue preserved`);
    await new Promise(resolve=>setTimeout(resolve,1000*2**attempt));
  }
}
async function fetchWorkbook(){
  const base=`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}`;
  const metadata=await get(`${base}?fields=spreadsheetId,sheets.properties`);
  const state=read('data/sheet-sync-state.json'),known=new Set(state.sheets.map(s=>s.sheetId));
  const result={spreadsheetId:SHEET_ID,sheets:[]};
  for(const sheet of metadata.sheets.filter(s=>known.has(s.properties.sheetId))){
    const props=sheet.properties, count=props.gridProperties.rowCount;
    if(count>25000)throw Error('Sheet exceeds configured sync size');
    const entry={properties:props,data:[]};result.sheets.push(entry);
    // Small bounded reads preserve formulas, hyperlinks, IMAGE URLs and calculated prices.
    for(let start=1;start<=count;start+=500){
      const range=`'${props.title.replaceAll("'","''")}'!A${start}:${String.fromCharCode(64+Math.min(props.gridProperties.columnCount,26))}${Math.min(start+499,count)}`;
      const params=new URLSearchParams({ranges:range,fields:'spreadsheetId,sheets(properties,data(startRow,rowData(values(formattedValue,effectiveValue,userEnteredValue,hyperlink,textFormatRuns))))'});
      const part=await get(`${base}?${params}`);entry.data.push(...(part.sheets?.[0]?.data||[]));
    }
  }
  return result;
}
async function main(){
  const source=arg('--source'); const workbook=source?JSON.parse(fs.readFileSync(source,'utf8')):await fetchWorkbook();
  if(args.includes('--baseline')){
    if(!source||!args.includes('--write'))throw Error('Baseline requires --source and --write');
    if(fs.existsSync(path.join(root,'data/sheet-sync-state.json')))throw Error('Baseline already exists');
    fs.writeFileSync(path.join(root,'data/sheet-sync-state.json'),JSON.stringify(baseline(workbook))+'\n');return;
  }
  const result=mergeSheet({catalogue:read('data/catalogue.json'),state:read('data/sheet-sync-state.json'),dates:read('data/product-added-at.json'),imageOverrides:read('data/sheet-sync-image-overrides.json'),workbook});
  const oldById=new Map(read('data/catalogue.json').items.map(item=>[item.id,item]));
  const fields={},samples=[];
  for(const item of result.catalogue.items){
    const old=oldById.get(item.id);if(!old)continue;
    for(const field of ['name','link','image','prices','categories','visibility'])if(JSON.stringify(old[field])!==JSON.stringify(item[field])){
      fields[field]=(fields[field]||0)+1;
      if(samples.length<5)samples.push({id:item.id,field,before:old[field],after:item[field]});
    }
  }
  console.log(JSON.stringify({...result.changes,fields,samples}));
  if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,`## Spreadsheet sync\n\nAdded: ${result.changes.added}; updated rows: ${result.changes.updated}; hidden: ${result.changes.hidden}; missing source products retained: ${result.changes.missing}; malformed rows skipped: ${result.changes.invalid}.\n`);
  if(!args.includes('--write'))return;
  const outputs={'data/catalogue.json':result.catalogue,'data/sheet-sync-state.json':result.state,'data/product-added-at.json':result.dates,'data/sheet-sync-image-overrides.json':result.imageOverrides};
  for(const [file,value] of Object.entries(outputs)){
    if(JSON.stringify(read(file))===JSON.stringify(value))continue;
    const target=path.join(root,file);fs.writeFileSync(target+'.tmp',JSON.stringify(value)+'\n');fs.renameSync(target+'.tmp',target);
  }
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
