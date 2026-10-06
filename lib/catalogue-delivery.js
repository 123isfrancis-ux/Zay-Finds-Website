const {normalizeSearch}=require('./catalogue');
function restoreSearchFields(items){return items.map(item=>({...item,_category:item.category.toLowerCase(),_categories:item.categories.map(c=>c.toLowerCase()),_search:normalizeSearch(`${item.name} ${item.categories.join(' ')}`)}));}
function cardImage(url,modern=true){
 try {const parsed=new URL(url);if(parsed.hostname==='si.geilicdn.com'){
  parsed.searchParams.set('w','400');
  if(modern){if(/\.(png|jpe?g)$/i.test(parsed.pathname))parsed.pathname+='.webp';parsed.searchParams.set('q','75');}
 }return parsed.toString();}catch{return url;}
}
async function boundedRanking(promise,ms=500){
 let timer;try{return await Promise.race([promise,new Promise(resolve=>{timer=setTimeout(()=>resolve({status:'unavailable',scores:{},collect:false}),ms);})]);}finally{clearTimeout(timer);}
}
module.exports={restoreSearchFields,cardImage,boundedRanking};
