const {audienceFor}=require('./audience');
function relatedFinds(item,items,audience='everyone') {
 const categories=new Set((item.categories||[item.category]).filter(c=>c&&c.toLowerCase()!=='main'));
 const seen=new Set([item.id]),links=new Set([item.link]);
 return items.filter(candidate=>{
  if(seen.has(candidate.id)||links.has(candidate.link)||candidate.visibility==='hidden'||!candidate.image||!candidate.link)return false;
  if(audience!=='everyone'&&audienceFor(candidate)!=='everyone'&&audienceFor(candidate)!==audience)return false;
  if(!(candidate.categories||[candidate.category]).some(c=>categories.has(c)))return false;
  seen.add(candidate.id);links.add(candidate.link);return true;
 }).slice(0,4);
}
module.exports={relatedFinds};
