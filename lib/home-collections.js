const { priceAmount } = require('./catalogue');
const { weidianId } = require('./weidian-images');
const COLLECTIONS = ['trending', 'new', 'budget'];
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
  if (collection === 'trending') return demand?.status === 'ready'
    ? visible.filter(item => item.image && Number.isFinite(demand.scores?.[item.id])).sort((a,b)=>demand.scores[b.id]-demand.scores[a.id]) : [];
  if (collection === 'new') return visible.filter(item => Number.isFinite(Date.parse(item.addedAt))).sort((a,b)=>Date.parse(b.addedAt)-Date.parse(a.addedAt));
  if (collection === 'budget') return visible.filter(item => {const price=priceAmount(item,currency,usdToCad);return Number.isFinite(price)&&price>0&&price<25;});
  return visible;
}
function newPreview(items) {
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
      for(const group of groups.values())if(group.length){result.push(group.shift());if(result.length===6)return result;}
    }
  }
  return result;
}
function homeSections(items, demand, currency, rate) {
  const visible=items.filter(item=>item.visibility!=='hidden');
  const trends=collectionItems(visible,'trending',demand,currency,rate);
  const definitions=[
    {key:trends.length?'trending':'explore',title:trends.length?'Trending This Week':'Explore the Finds',description:trends.length?'The finds shoppers are clicking and saving.':'A starting point for your next favorite.',items:trends.length?trends:visible},
    {key:'bought',title:'Zay Actually Bought These',description:'Finds from my own orders.',items:visible.filter(item=>item.personallyBought)},
    {key:'budget',title:`Under $25 ${currency}`,description:'Small prices. Good finds. Item prices before shipping.',items:collectionItems(visible,'budget',demand,currency,rate)},
    {key:'new',title:'Just Added',description:'The latest additions to the collection.',items:collectionItems(visible,'new',demand,currency,rate)},
  ];
  return definitions.map(section=>({...section,items:section.key==='new'?newPreview(section.items.filter(item=>item.image)):section.items.filter(item=>item.image).slice(0,6)})).filter(section=>section.items.length);
}
module.exports={normalizeCollection,additionKey,recordAddedDates,collectionItems,homeSections};
