const definitions = require('../data/shop-the-fit.json');
const { audienceFor } = require('./audience');
const { priceAmount } = require('./catalogue');
// Build A Fit defaults to men's looks; women's looks require Women mode.
function fitAudience(value){return value==='women'?'women':'men';}
function availableLooks(items, audience='everyone', looks=definitions) {
  audience=fitAudience(audience);
  const products = new Map(items.map(item=>[item.id,item]));
  return looks.filter(look=>look.audience==='everyone'||look.audience===audience).flatMap(look=>{
    const pieces=look.pieces.map(piece=>({...piece,item:products.get(piece.id)}));
    // Hide the whole look if a piece disappears; never sell a partial outfit as complete.
    if(new Set(pieces.map(p=>p.id)).size!==pieces.length || pieces.length<2 || pieces.some(({item})=>!item || item.visibility==='hidden' || !item.image || !item.link || (audience!=='everyone' && audienceFor(item)!=='everyone' && audienceFor(item)!==audience)))return [];
    return [{...look,pieces}];
  });
}
const displayedAmount = new Intl.NumberFormat('en-US',{minimumFractionDigits:2,maximumFractionDigits:2,useGrouping:false});
function lookTotal(pieces,currency,rate) {
  const cents=pieces.map(({item})=>item?priceAmount(item,currency,rate):NaN).map(amount=>Number.isFinite(amount)?Math.round(Number(displayedAmount.format(amount))*100):null);
  return cents.some(amount=>amount===null)?null:cents.reduce((sum,amount)=>sum+amount,0)/100;
}
function saveLook(current, ids, limit=500) {
  const unique=[...new Set(current)];
  const added=[...new Set(ids)].filter(id=>!unique.includes(id));
  return unique.length+added.length>limit ? {ids:current,added:[],status:'full'} : {ids:[...unique,...added],added,status:added.length?'saved':'already'};
}
// Retain reviewed looks and their links when a listing is missing. A missing piece
// is a visible gap, never silently substituted or counted as free.
function reviewedLooks(items,audience='everyone',looks=definitions) {
 audience=fitAudience(audience);
 const products=new Map(items.map(item=>[item.id,item]));
 const usable=(item,look)=>item&&item.visibility!=='hidden'&&item.image&&item.link&&(audienceFor(item)==='everyone'||audienceFor(item)===audience);
 return looks.filter(look=>look.audience==='everyone'||look.audience===audience).flatMap(look=>{
  if(look.pieces.length<2||new Set(look.pieces.map(p=>p.id)).size!==look.pieces.length)return [];
  const pieces=look.pieces.map(piece=>({...piece,item:usable(products.get(piece.id),look)?products.get(piece.id):null,alternatives:(piece.alternatives||[]).filter(option=>usable(products.get(option.id),look)).map(option=>({...option,item:products.get(option.id)}))}));
  return [{...look,pieces,complete:pieces.every(p=>p.item)}];
 });
}
function applyLookSwaps(look,value) {
 const selected=new Map();
 if(typeof value==='string'&&value.length<=400)for(const entry of value.split(',')){
  const [slot,id]=entry.split(':');if(/^\d$/.test(slot)&&!selected.has(Number(slot)))selected.set(Number(slot),id);
 }
 const pieces=look.pieces.map((piece,index)=>{
  const option=piece.alternatives?.find(p=>p.id===selected.get(index));
  return option?{...piece,...option,alternatives:piece.alternatives,baseId:piece.id,basePiece:piece}:piece;
 });
 // Reject duplicate products across slots, even for malformed shared links.
 if(new Set(pieces.map(p=>p.id)).size!==pieces.length)return {...look,swap:''};
 return {...look,pieces,complete:pieces.every(p=>p.item),swap:pieces.flatMap((p,i)=>p.baseId?[`${i}:${p.id}`]:[]).join(',')};
}
function swapValue(look,slot,id) {
 const entries=new Map((look.swap||'').split(',').filter(Boolean).map(value=>value.split(':')));
 const base=look.pieces[slot]?.baseId||look.pieces[slot]?.id;
 if(id===base)entries.delete(String(slot));else entries.set(String(slot),id);
 return [...entries].map(([key,value])=>`${key}:${value}`).join(',');
}
function filterLooks(looks,{occasion='',layers='',budget=''},currency,rate) {
 return looks.filter(look=>(!occasion||look.occasion===occasion)&&(!layers||look.layers===layers)&&(!budget||(look.complete&&lookTotal(look.pieces,currency,rate)!==null&&lookTotal(look.pieces,currency,rate)<=Number(budget))));
}
function quoteEstimate(subtotal,shipping,extras){
 if(!Number.isFinite(subtotal)||subtotal<=0)return null;
 const values=[shipping,extras];
 if(values.some(value=>typeof value!=='string'||!/^\d{1,5}(?:\.\d{1,2})?$/.test(value)||Number(value)>10000))return null;
 return [subtotal,...values.map(Number)].reduce((sum,value)=>sum+Math.round(value*100),0)/100;
}
module.exports={fitAudience,availableLooks,reviewedLooks,applyLookSwaps,swapValue,filterLooks,lookTotal,saveLook,quoteEstimate};
