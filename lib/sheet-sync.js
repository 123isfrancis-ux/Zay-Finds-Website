const {createHash}=require('node:crypto');
const {importSheet,linkOf,SHEET_ID}=require('./google-sheet');
const {weidianId}=require('./weidian-images');
const hash=value=>createHash('sha256').update(value).digest('hex').slice(0,24);
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function productKey(link){
  const wid=weidianId(link); if(wid)return `weidian:${wid}`;
  try {
    let url=new URL(link);
    if(/(^|\.)kakobuy\.com$/.test(url.hostname)&&url.searchParams.has('url'))url=new URL(url.searchParams.get('url'));
    if(/(^|\.)weidian\.com$/.test(url.hostname))return null; // malformed item ID
    for(const field of ['affcode','utm_source','utm_medium','utm_campaign'])url.searchParams.delete(field);
    url.hash=''; url.searchParams.sort(); return url.href;
  }catch{return null;}
}
const rounded=prices=>Object.fromEntries(Object.entries(prices).filter(([,v])=>Number.isFinite(v)&&v>=0).map(([k,v])=>[k,Math.round(v*100)/100]));
function readProducts(workbook){
  if(workbook.spreadsheetId!==SHEET_ID)throw Error('Unexpected spreadsheet ID');
  const parsed=importSheet(workbook,'baseline'); const products={}; let invalid=0;
  for(const item of parsed.items){
    const key=productKey(item.link);
    if(!key){invalid++;continue;}
    if(/\b(perfume|fragrance|cologne|eau de parfum|eau de toilette)\b/i.test(item.name))continue;
    if(!products[key])products[key]={name:item.name,link:item.link,image:item.image,prices:rounded(item.prices),categories:[...item.categories]};
    else products[key].categories=[...new Set([...products[key].categories,...item.categories])];
  }
  // An optional, explicitly named column; ordinary notes never hide products.
  for(const sheet of workbook.sheets){
    const rows=(sheet.data||[]).flatMap(g=>g.rowData||[]);
    const header=rows.map(r=>(r.values||[]).findIndex(c=>/^website status$/i.test((c.formattedValue||c.userEnteredValue?.stringValue||'').trim()))).find(i=>i>=0);
    if(header===undefined)continue;
    for(const row of rows){
      const cells=row.values||[];const status=(cells[header]?.formattedValue||cells[header]?.userEnteredValue?.stringValue||'').trim().toLowerCase();
      if(!['hide','hidden','show','visible'].includes(status))continue;
      const key=productKey(linkOf(cells[1])||linkOf(cells[2]));
      if(products[key])products[key].status=['hide','hidden'].includes(status)?'hidden':'visible';
    }
  }
  return {products,invalid,sheets:workbook.sheets.map(s=>({sheetId:s.properties.sheetId,title:s.properties.title}))};
}
function baseline(workbook){return {version:1,spreadsheetId:SHEET_ID,...readProducts(workbook),hiddenBySync:[]};}
function mergeSheet({catalogue,state,workbook,dates,imageOverrides={},now=new Date().toISOString()}){
  if(state.version!==1||state.spreadsheetId!==SHEET_ID)throw Error('Invalid sync baseline');
  const current=readProducts(workbook), previous=state.products;
  const ids=new Set(current.sheets.map(s=>s.sheetId));
  if(state.sheets.some(s=>!ids.has(s.sheetId)))throw Error('A configured sheet is missing; catalogue preserved');
  if(Object.keys(current.products).length<Math.max(1,Object.keys(previous).length*.8))throw Error('Source shrank by more than 20%; catalogue preserved');
  const changes={added:0,updated:0,hidden:0,missing:0,invalid:current.invalid};
  const next=structuredClone(catalogue), nextDates={...dates}, nextImages={...imageOverrides};
  const groups=new Map();for(const item of next.items){const key=productKey(item.link);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(item);}
  const hidden=new Set(state.hiddenBySync||[]);
  for(const [key,source] of Object.entries(current.products)){
    const before=previous[key], matches=groups.get(key)||[];
    // Existing baseline-only products were intentionally excluded from the website.
    if(!matches.length&&before)continue;
    if(!matches.length){
      if(!source.image||!Object.values(source.prices).some(p=>p>0))throw Error('A new product is missing a photo or positive price; finish that row before syncing');
      const id=hash(`zay-sheet-sync:${key}`),item={id,name:source.name,link:source.link,image:source.image,prices:source.prices,price_usd:source.prices.USD??'',category:source.categories[0],categories:source.categories,visibility:source.status==='hidden'?'hidden':'catalog',source:{spreadsheetId:SHEET_ID,syncKey:key}};
      next.items.push(item); nextDates[weidianId(item.link)||item.link]=now;changes.added++;
      if(item.visibility==='hidden')hidden.add(id);
      continue;
    }
    if(!before)continue; // Local-only records remain protected on their first appearance.
    for(const item of matches){
      const original=JSON.stringify(item);
      for(const field of ['name','link'])if(!equal(source[field],before[field]))item[field]=source[field];
      if(source.image&&!equal(source.image,before.image)){item.image=source.image;nextImages[item.id]=source.image;}
      for(const [currency,value] of Object.entries(source.prices))if(value!==before.prices[currency])item.prices={...item.prices,[currency]:value};
      item.price_usd=item.prices.USD??'';
      if(!equal(source.categories,before.categories)){
        const removed=before.categories.filter(c=>!source.categories.includes(c));
        item.categories=[...new Set([...item.categories.filter(c=>!removed.includes(c)),...source.categories])];
        if(!item.categories.includes(item.category))item.category=item.categories[0];
      }
      if(source.status==='hidden'&&item.visibility!=='hidden'){item.visibility='hidden';hidden.add(item.id);changes.hidden++;}
      if(source.status==='visible'&&hidden.has(item.id)){item.visibility='catalog';hidden.delete(item.id);}
      if(JSON.stringify(item)!==original)changes.updated++;
    }
  }
  changes.missing=Object.keys(previous).filter(k=>!current.products[k]).length;
  if(changes.added>100||changes.hidden>50)throw Error('Large addition or hiding batch needs review; catalogue preserved');
  // Keep missing entries in the baseline so reappearing rows are not treated as new.
  const nextState={...state,products:{...previous,...current.products},sheets:current.sheets,invalid:current.invalid,hiddenBySync:[...hidden]};
  if(changes.added||changes.updated){next.importedAt=now;next.collections=[...new Set([...next.collections,...current.sheets.map(s=>s.title.trim())])];}
  return {catalogue:next,state:nextState,dates:nextDates,imageOverrides:nextImages,changes};
}
module.exports={productKey,readProducts,baseline,mergeSheet};
