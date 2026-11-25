const {rankRecommended} = require('./trending');
const featuredNewIds = require('../data/just-added-picks.json');
const previewExclusions = new Set(require('../data/just-added-preview-exclusions.json'));
const { priceAmount } = require('./catalogue');
const { weidianId } = require('./weidian-images');
const popularPicks = require('../data/popular-picks.json');
const COLLECTIONS = ['trending', 'new', 'budget', 'popular'];
function normalizeCollection(value) {
  const first = Array.isArray(value) ? value[0] : value;
  return COLLECTIONS.includes(first) ? first : '';
}
function additionKey(item) { return weidianId(item.link) || item.link || item.id; }
function recordAddedDates(previous, next, known, date) {
  if (!Number.isFinite(Date.parse(date))) throw Error('Invalid addition date');
  const existing = new Set(previous.map(additionKey));
  const result = {...known};
  for (const item of next) {
    const key = additionKey(item);
    if (key && !existing.has(key) && !result[key]) result[key] = date;
  }
  return result;
}
function collectionItems(items, collection, demand, currency='USD', usdToCad=1) {
  const visible = items.filter(item => item.visibility !== 'hidden');
  if (collection === 'popular') return popularPicks.map(id=>visible.find(item=>item.id===id && item.image)).filter(Boolean);
  if (collection === 'trending') return demand?.status === 'ready'
    ? rankRecommended(visible.filter(item => item.image && Number.isFinite(demand.scores?.[item.id])).sort((a,b)=>demand.scores[b.id]-demand.scores[a.id]), demand) : [];
  if (collection === 'new') {
    const eligible=visible.filter(item => !item.excludeFromJustAdded);
    const dated=eligible.filter(item => Number.isFinite(Date.parse(item.addedAt))).sort((a,b)=>Date.parse(b.addedAt)-Date.parse(a.addedAt));
    const featured=featuredNewIds.map(id=>eligible.find(item=>item.id===id && item.image)).filter(Boolean);
    // Editorial additions join the collection without inventing import dates.
    return [...dated,...featured.filter(item=>!dated.some(other=>other.id===item.id))];
  }
  if (collection === 'budget') return visible.filter(item => {const price=priceAmount(item,currency,usdToCad);return Number.isFinite(price)&&price>0&&price<25;});
  return visible;
}
function newPreview(items, seed) {
  const featured=dailyOrder(featuredNewIds.map(id=>items.find(item=>item.id===id)).filter(Boolean),seed);
  // Large imports stay available in See all; only reviewed picks enter the homepage rail.
  const recent=datedPreview(dailyOrder(items.filter(item=>!featuredNewIds.includes(item.id) && !previewExclusions.has(additionKey(item))),seed).sort((a,b)=>Date.parse(b.addedAt)-Date.parse(a.addedAt)));
  const mixed=[];
  let recentSlots=Math.max(0,12-featured.length);
  const interval=recentSlots?Math.ceil(12/recentSlots):12;
  while(mixed.length<12 && (recent.length || featured.length)) {
    if(recent.length && (!featured.length || (recentSlots>0 && mixed.length%interval===0))) {
      mixed.push(recent.shift());recentSlots--;
    } else if(featured.length) mixed.push(featured.shift());
    else break;
  }
  return mixed;
}
function datedPreview(items) {
  const result=[];
  const dates=[...new Set(items.map(item=>item.addedAt))];
  for(const date of dates) {
    const groups=new Map();
    for(const item of items.filter(item=>item.addedAt===date)) {
      const group=(item.categories||[item.category]).find(label=>label && label.toLowerCase()!=='main')||'other';
      if(!groups.has(group))groups.set(group,[]);
      groups.get(group).push(item);
    }
    while([...groups.values()].some(group=>group.length)) {
      for(const group of groups.values())if(group.length){result.push(group.shift());if(result.length===12)return result;}
    }
  }
  return result;
}
// A deterministic daily order keeps revisits fresh without shuffling during a visit.
function dailyOrder(items, seed) {
  function hash(text) { let n=2166136261; for(const c of text)n=Math.imul(n^c.charCodeAt(0),16777619); n^=n>>>16;n=Math.imul(n,0x85ebca6b);n^=n>>>13;return n>>>0; }
  return [...items].sort((a,b)=>hash(`${seed}:${a.id}`)-hash(`${seed}:${b.id}`)||String(a.id).localeCompare(String(b.id)));
}
function rotatePreview(items, demand, seed, mixed=false) {
  const pool=items.filter(item=>item.image), selected=[];
  const take=(list,count)=>{for(const item of list){if(count<=0)break;if(!selected.some(x=>x.id===item.id)){selected.push(item);count--;}}};
  if(mixed){
    const proven=pool.filter(i=>Number.isFinite(demand?.scores?.[i.id])).sort((a,b)=>demand.scores[b.id]-demand.scores[a.id]);
    take(proven,6);
    // Missing evidence is not failure: unused slots become discovery slots.
    const fresh=pool.filter(i=>Number.isFinite(Date.parse(i.addedAt))).sort((a,b)=>Date.parse(b.addedAt)-Date.parse(a.addedAt));
    take(dailyOrder(fresh.slice(0,60),seed+':fresh'),4);
  }
  take(dailyOrder(pool,seed),12-selected.length);
  // Interleave product types instead of grouping similar products together.
  const {productGroup}=require('./trending');
  const result=[];
  while(selected.length){const previous=result.length?productGroup(result[result.length-1]):null;let index=selected.findIndex(i=>productGroup(i)!==previous);if(index<0)index=0;result.push(selected.splice(index,1)[0]);}
  return result;
}
function homeSections(items, demand, currency, rate, seed=new Date().toISOString().slice(0,10)) {
  const visible=items.filter(item=>item.visibility!=='hidden');
  const popular=collectionItems(visible,'popular',demand,currency,rate);
  const popularIds=new Set(popular.map(item=>item.id));
  const rankedTrends=collectionItems(visible,'trending',demand,currency,rate);
  const trends=[...rankedTrends.filter(item=>!popularIds.has(item.id)),
    ...rankedTrends.filter(item=>popularIds.has(item.id))];
  const definitions=[
    {key:'popular',title:'Popular Picks',description:'A handpicked edit of finds shoppers have been clicking.',items:popular},
    {key:trends.length?'trending':'explore',title:trends.length?'Trending This Week':'Explore the Finds',description:trends.length?'The finds shoppers are clicking and saving.':'A starting point for your next favorite.',items:trends.length?trends:visible},
    {key:'bought',title:'Zay Actually Bought These',description:'Finds from my own orders.',items:visible.filter(item=>item.personallyBought)},
    {key:'budget',title:`Under $25 ${currency}`,description:'Small prices. Good finds. Item prices before shipping.',items:collectionItems(visible,'budget',demand,currency,rate)},
    {key:'new',title:'Just Added',description:'New arrivals and fresh picks from across the collection.',items:collectionItems(visible,'new',demand,currency,rate)},
  ];
  return definitions.map(section=>({...section,items:section.key==='trending'?section.items.filter(item=>item.image).slice(0,12):section.key==='new'?newPreview(section.items.filter(item=>item.image),seed+':new'):rotatePreview(section.items,demand,seed+':'+section.key,section.key==='budget'||section.key==='bought')})).filter(section=>section.items.length && section.key!=='explore');
}
module.exports={normalizeCollection,additionKey,recordAddedDates,collectionItems,homeSections,dailyOrder,rotatePreview};
