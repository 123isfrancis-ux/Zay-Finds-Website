const { mixImportedWatches } = require('./watch-merchandising');
// Pure ranking functions shared by the browser and server. Never reorder inputs.
const WINDOW_DAYS = 7;
const MIN_VIEWS = 30;
const MIN_ACTIONS = 5;
function dayKey(now = Date.now()) { return new Date(now).toISOString().slice(0, 10); }
function aggregateDays(days) {
  const totals = {};
  days.slice(0, WINDOW_DAYS).forEach((fields, age) => {
    const weight = 2 ** (-age / 3);
    for (const [field, raw] of Object.entries(fields || {})) {
      const [id, type] = field.split(':');
      const count = Number(raw);
      if (!/^[a-zA-Z0-9_-]{1,64}$/.test(id) || !['view','click','save'].includes(type) || !Number.isFinite(count) || count < 0) continue;
      const row = totals[id] ||= { view: 0, click: 0, save: 0, rawViews: 0, rawActions: 0 };
      row[type] += count * weight;
      if (type === 'view') row.rawViews += count;
      else row.rawActions += count;
    }
  });
  return totals;
}
function scoreProduct(row) {
  if (!row || row.rawViews < MIN_VIEWS || row.rawActions < MIN_ACTIONS) return null;
  // Smoothed rates resist one-click winners; saves carry twice the weight.
  const views = Math.max(0, row.view);
  return (Math.min(views, row.click) + 2 * Math.min(views, row.save) + 3) / (3 * (views + 30));
}
function makeSnapshot(days, validIds, now = Date.now(), items = []) {
  const scores = {};
  for (const [id, row] of Object.entries(aggregateDays(days))) {
    if (!validIds.has(id)) continue;
    const score = scoreProduct(row);
    if (score !== null) scores[id] = score;
  }
  return { version: 1, status: Object.keys(scores).length >= 3 ? 'ready' : 'learning', scores, seed: dayKey(now), adaptive: adaptiveScores(days, items.filter(item => validIds.has(item.id))) };
}
function hash(text) {
  let value = 2166136261;
  for (let i = 0; i < text.length; i++) value = Math.imul(value ^ text.charCodeAt(i), 16777619);
  return value >>> 0;
}
function rankTrending(items, snapshot) {
  if (snapshot?.status !== 'ready') return [...items];
  const ranked = [], discovery = [];
  items.forEach((item, index) => {
    const score = snapshot.scores?.[item.id];
    if (Number.isFinite(score) && score >= 0 && item.image) ranked.push({ item, score, index });
    else discovery.push(item);
  });
  // A category with no proven trends keeps its established sheet order.
  if (!ranked.length) return [...items];
  ranked.sort((a,b) => b.score - a.score || a.index - b.index);
  discovery.sort((a,b) => Number(Boolean(b.image)) - Number(Boolean(a.image)) || hash(`${snapshot.seed}:${a.id}`) - hash(`${snapshot.seed}:${b.id}`));
  const result = [];
  let r = 0, d = 0;
  while (r < ranked.length || d < discovery.length) {
    // One in five slots offers an underexposed product a chance to be seen.
    if (d < discovery.length && (r >= ranked.length || result.length % 5 === 4)) result.push(discovery[d++]);
    else result.push(ranked[r++].item);
  }
  return result;
}
module.exports = { WINDOW_DAYS, MIN_VIEWS, MIN_ACTIONS, dayKey, aggregateDays, scoreProduct, makeSnapshot, rankTrending };

// Compare product types, not merchandising sections such as Main or TikTok.
function productGroup(item) {
 const name = String(item.name || '').toLowerCase();
 const groups = [
  ['watches', /watch|rolex|patek|cartier santos|royal oak|nautilus/],
  ['shoes', /shoe|sneaker|loafer|boot|sandal|slipper|trainer|jordan|dunk|air force|gats/],
  ['bags', /bag|backpack|purse|wallet|suitcase/],
  ['bottoms', /pants|trouser|jeans|shorts|skirt|leggings|sweats/],
  ['tops', /shirt|hoodie|sweater|jacket|coat|polo|tee|pullover|vest|cardigan|crewneck/],
  ['dresses', /dress|jumpsuit|romper/],
  ['accessories', /necklace|bracelet|ring|earring|beanie|cap|hat|belt|glasses/]
 ];
 for (const [group, pattern] of groups) if (pattern.test(name)) return group;
 const specific = (item.categories || [item.category]).filter(Boolean).map(c=>c.toLowerCase()).filter(c=>!['main','all items from tiktok','all taobao finds','resell'].includes(c)).sort();
 return specific[0] ? 'category:'+specific[0] : null;
}
function adaptiveScores(days, items) {
 const totals=aggregateDays(days), groups=new Map(), scores={}, low=[];
 for(const item of items) {
  if(item.visibility==='hidden'||!item.image)continue;
  const group=productGroup(item), row=totals[item.id];
  if(!group||!row||row.rawViews<100)continue;
  if(!groups.has(group))groups.set(group,[]);
  groups.get(group).push({id:item.id,row});
 }
 for(const rows of groups.values()) {
  // Require several comparable products before moving any of them on evidence.
  if(rows.length<3)continue;
  const views=rows.reduce((n,r)=>n+r.row.view,0);
  const clicks=rows.reduce((n,r)=>n+Math.min(r.row.click,r.row.view),0);
  if(views<100||clicks<5)continue;
  const baseline=(clicks+1)/(views+50);
  for(const {id,row} of rows) {
   const rate=(Math.min(row.click,row.view)+50*baseline)/(row.view+50);
   const relative=rate/baseline;
   scores[id]=relative/(1+relative);
   if(relative<0.6)low.push(id);
  }
 }
 return {scores,low};
}
function rankRecommended(items, snapshot) {
 if(!['ready','learning'].includes(snapshot?.status))return mixImportedWatches(items);
 const scores=snapshot.adaptive?.scores;
 if(!scores||!items.some(i=>Number.isFinite(scores[i.id])))return mixImportedWatches(items);
 const lows=new Set(snapshot.adaptive.low||[]), proven=[], discovery=[], down=[], noPhoto=[];
 items.forEach((item,index)=>{
  if(!item.image){noPhoto.push(item);return;}
  const score=scores[item.id];
  if(lows.has(item.id)&&Number.isFinite(score))down.push({item,score,index});
  else if(Number.isFinite(score))proven.push({item,score,index});
  else discovery.push(item);
 });
 const order=(a,b)=>b.score-a.score||a.index-b.index;
 proven.sort(order);down.sort(order);
 discovery.sort((a,b)=>hash(`${snapshot.seed}:${a.id}`)-hash(`${snapshot.seed}:${b.id}`));
 const result=[];let p=0,d=0;
 while(p<proven.length||d<discovery.length){
  if(d<discovery.length&&(p>=proven.length||result.length%5===4))result.push(discovery[d++]);
  else result.push(proven[p++].item);
 }
 return mixImportedWatches([...result,...down.map(r=>r.item),...noPhoto]);
}
module.exports.productGroup=productGroup;
module.exports.adaptiveScores=adaptiveScores;
module.exports.rankRecommended=rankRecommended;
