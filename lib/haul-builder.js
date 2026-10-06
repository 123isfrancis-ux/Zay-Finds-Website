const {priceAmount}=require('./catalogue');
const MAX_BOARDS=20, MAX_ITEMS=100;
function cleanIds(value,limit=MAX_ITEMS) {
  return Array.isArray(value)?[...new Set(value.filter(id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{1,64}$/.test(id)))].slice(0,limit):[];
}
function cleanName(value) {return typeof value==='string'?value.trim().slice(0,60):'';}
function cleanBoards(value) {
  if(!Array.isArray(value))return [];
  const seen=new Set();
  return value.slice(0,MAX_BOARDS).flatMap(board=>{
    if(!board||typeof board.id!=='string'||!/^haul-[a-zA-Z0-9-]{1,70}$/.test(board.id)||seen.has(board.id)||!cleanName(board.name))return [];
    seen.add(board.id);return [{id:board.id,name:cleanName(board.name),ids:cleanIds(board.ids)}];
  });
}
function addToBoard(board,ids) {
  const next=cleanIds([...board.ids,...cleanIds(ids)],500);
  return next.length>MAX_ITEMS?{board,status:'full'}:{board:{...board,ids:next},status:next.length===board.ids.length?'already':'added'};
}
function resolveHaul(ids,items) {
  const byId=new Map(items.filter(i=>i.visibility!=='hidden'&&i.link).map(i=>[i.id,i]));
  return cleanIds(ids,500).map(id=>byId.get(id)).filter(Boolean);
}
const displayedAmount=new Intl.NumberFormat('en-US',{minimumFractionDigits:2,maximumFractionDigits:2,useGrouping:false});
function subtotal(items,currency,rate) {
  let cents=0,unknown=0;
  for(const item of items){const amount=priceAmount(item,currency,rate);if(!Number.isFinite(amount)){unknown++;continue;}cents+=Math.round(Number(displayedAmount.format(amount))*100);}
  return {amount:cents/100,unknown};
}
function shareHash(board) {
  const ids=cleanIds(board.ids);if(!ids.length)return '';
  return '#haul='+encodeURIComponent(JSON.stringify({v:1,name:cleanName(board.name)||'Shared haul',ids}));
}
function readSharedHaul(hash) {
  if(typeof hash!=='string'||hash.length>16000||!hash.startsWith('#haul='))return null;
  try {const data=JSON.parse(decodeURIComponent(hash.slice(6)));if(data.v!==1||!Array.isArray(data.ids)||data.ids.length>MAX_ITEMS)return null;
    const ids=cleanIds(data.ids);if(!ids.length||ids.length!==data.ids.length)return null;
    return {name:cleanName(data.name)||'Shared haul',ids};
  }catch{return null;}
}
module.exports={MAX_BOARDS,MAX_ITEMS,cleanIds,cleanBoards,cleanName,addToBoard,resolveHaul,subtotal,shareHash,readSharedHaul};
