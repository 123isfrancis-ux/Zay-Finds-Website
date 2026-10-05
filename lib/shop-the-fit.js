const definitions = require('../data/shop-the-fit.json');
const { audienceFor } = require('./audience');
const { priceAmount } = require('./catalogue');
function availableLooks(items, audience='everyone', looks=definitions) {
  const products = new Map(items.map(item=>[item.id,item]));
  return looks.filter(look=>audience==='everyone'||look.audience==='everyone'||look.audience===audience).flatMap(look=>{
    const pieces=look.pieces.map(piece=>({...piece,item:products.get(piece.id)}));
    // Hide the whole look if a piece disappears; never sell a partial outfit as complete.
    if(new Set(pieces.map(p=>p.id)).size!==pieces.length || pieces.length<2 || pieces.some(({item})=>!item || item.visibility==='hidden' || !item.image || !item.link || (audience!=='everyone' && audienceFor(item)!=='everyone' && audienceFor(item)!==audience)))return [];
    return [{...look,pieces}];
  });
}
const displayedAmount = new Intl.NumberFormat('en-US',{minimumFractionDigits:2,maximumFractionDigits:2,useGrouping:false});
function lookTotal(pieces,currency,rate) {
  const cents=pieces.map(({item})=>priceAmount(item,currency,rate)).map(amount=>Number.isFinite(amount)?Math.round(Number(displayedAmount.format(amount))*100):null);
  return cents.some(amount=>amount===null)?null:cents.reduce((sum,amount)=>sum+amount,0)/100;
}
function saveLook(current, ids, limit=500) {
  const unique=[...new Set(current)];
  const added=[...new Set(ids)].filter(id=>!unique.includes(id));
  return unique.length+added.length>limit ? {ids:current,added:[],status:'full'} : {ids:[...unique,...added],added,status:added.length?'saved':'already'};
}
module.exports={availableLooks,lookTotal,saveLook};
