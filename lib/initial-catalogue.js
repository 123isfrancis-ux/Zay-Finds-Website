const {audienceFor, audienceFromQuery}=require('./audience');
const {catalogueFiltersFromQuery,viewItems,categoriesFor,filterAndSort}=require('./catalogue');
const {normalizeCollection,collectionItems,homeSections}=require('./home-collections');
const {rankRecommended}=require('./trending');
const {availableLooks}=require('./shop-the-fit');
const {usdToCad}=require('../data/exchange-rate.json');
function prepareInitialCatalogue(items,collections,query,demand) {
  const audience=audienceFromQuery(query.audience,'everyone');
  const filters=catalogueFiltersFromQuery(query);
  const view=query.fit?'fits':filters.view||'all';
  const scoped=items.filter(i=>i.visibility!=='hidden'&&(audience==='everyone'||audienceFor(i)==='everyone'||audienceFor(i)===audience));
  const categories=categoriesFor(scoped,collections);
  const category=categories.some(c=>c.value===filters.category)?filters.category:'';
  const collection=view==='all'?normalizeCollection(query.collection):'';
  const base=viewItems(collectionItems(scoped,collection,demand,'USD',usdToCad),view,new Set());
  const sorted=filterAndSort(base,category,'default');
  const list=collection?sorted:rankRecommended(sorted,demand);
  const sections=view==='all'&&!category&&!collection?homeSections(scoped,demand,'USD',usdToCad):[];
  const preview=!['saved','fits'].includes(view);
  const selected=new Map([...list.slice(0,24),...sections.flatMap(s=>s.items)].map(i=>[i.id,i]));
  const fitPreview=view==='fits';
  // Include every reviewed look's products so changing audience never needs the full store.
  const fitIds=new Set(fitPreview?availableLooks(items).flatMap(look=>look.pieces.map(piece=>piece.id)):[]);
  const rows=items.filter(i=>preview?selected.has(i.id):fitPreview&&fitIds.has(i.id)).map(({_search,_category,_categories,...i})=>i);
  const fitCounts=fitPreview?Object.fromEntries(['everyone','men','women'].map(value=>{
    const scopedItems=items.filter(i=>i.visibility!=='hidden'&&(value==='everyone'||audienceFor(i)==='everyone'||audienceFor(i)===value));
    return [value,{all:scopedItems.length,bought:scopedItems.filter(i=>i.personallyBought).length,week:scopedItems.filter(i=>i.visibility==='weekly').length}];
  })):null;
  return {items:rows,collections,demand,audience,view,category,collection,categories,preview,fitPreview,fitCounts,
    total:list.length,visibleIds:preview?list.slice(0,24).map(i=>i.id):[],
    sections:sections.map(({items,...s})=>({...s,ids:items.map(i=>i.id)})),
    counts:{all:scoped.length,bought:scoped.filter(i=>i.personallyBought).length,week:scoped.filter(i=>i.visibility==='weekly').length,saved:0}};
}
module.exports={prepareInitialCatalogue};
