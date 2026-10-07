const {searchText}=require('./catalogue');
function restoreSearchFields(items){return items.map(item=>({...item,_category:item.category.toLowerCase(),_categories:item.categories.map(c=>c.toLowerCase()),_search:searchText(item)}));}
function cardImage(url,modern=true){
 try {const parsed=new URL(url);if(parsed.hostname==='si.geilicdn.com'){
  parsed.searchParams.set('w','400');
  if(modern){if(/\.(png|jpe?g)$/i.test(parsed.pathname))parsed.pathname+='.webp';parsed.searchParams.set('q','75');}
 }return parsed.toString();}catch{return url;}
}
function fitImage(url,width=600,modern=true) {
 const image=cardImage(url,modern);
 try {const parsed=new URL(image);if(parsed.hostname==='si.geilicdn.com'){
  parsed.searchParams.set('w',String(width));parsed.searchParams.delete('h');
 }return parsed.toString();}catch{return image;}
}
function fitImageSet(url) {
 try {if(new URL(url).hostname!=='si.geilicdn.com')return undefined;}catch{return undefined;}
 return [180,240,320,450,600,900].map(width=>`${fitImage(url,width)} ${width}w`).join(', ');
}
async function boundedRanking(promise,ms=500){
 let timer;try{return await Promise.race([promise,new Promise(resolve=>{timer=setTimeout(()=>resolve({status:'unavailable',scores:{},collect:false}),ms);})]);}finally{clearTimeout(timer);}
}
module.exports={restoreSearchFields,cardImage,fitImage,fitImageSet,boundedRanking};
