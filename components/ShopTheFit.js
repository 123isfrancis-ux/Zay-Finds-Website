import {fitImage,fitImageSet} from '../lib/catalogue-delivery';
import {siteSignal} from '../lib/site-signals';
import {useEffect,useRef,useState} from 'react';
import {lookTotal,filterLooks,swapValue,quoteEstimate} from '../lib/shop-the-fit';
import {priceAmount} from '../lib/catalogue';
function money(amount,currency) {return (currency==='CAD'?'≈ ':'')+new Intl.NumberFormat('en-US',{style:'currency',currency}).format(amount);}
function FitPhoto({item,width,height,priority}) {
 const [failed,setFailed]=useState(false),[original,setOriginal]=useState(false);
 const sizes=priority
  ? '(max-width: 640px) calc((100vw - 60px) * 0.66), (max-width: 900px) calc((100vw - 84px) * 0.66), (max-width: 1248px) calc((100vw - 84px) * 0.36), 430px'
  : '(max-width: 640px) calc((100vw - 60px) * 0.33), (max-width: 900px) calc((100vw - 84px) * 0.33), (max-width: 1248px) calc((100vw - 84px) * 0.18), 215px';
 return failed?<span className="fit-photo-fallback" style={{aspectRatio:`${width} / ${height}`}}>View photo at seller</span>:<img src={fitImage(item.image,600,!original)} srcSet={original?undefined:fitImageSet(item.image)} sizes={sizes} alt={item.name} width={width} height={height} loading={priority?'eager':'lazy'} fetchPriority={priority?'high':'auto'} decoding="async" onError={()=>{if(!original&&fitImage(item.image)!==fitImage(item.image,600,false)){setOriginal(true);return;}setFailed(true);siteSignal({type:'image_error',id:item.id});}}/>;
}
function LookThumb({piece}) {
 const [failed,setFailed]=useState(false);
 return piece?.item&&!failed?<img src={fitImage(piece.item.image,120)} alt="" width="72" height="72" loading="lazy" fetchPriority="low" onError={()=>setFailed(true)}/>:<span className="fit-thumb-empty" aria-hidden="true">—</span>;
}
function DeliveryEstimate({subtotal,currency}) {
 const [shipping,setShipping]=useState(''),[extras,setExtras]=useState('');
 const estimate=quoteEstimate(subtotal,shipping,extras);
 return <details className="fit-checklist"><summary>Add your delivery quote</summary><p>Enter your seller or agent’s combined delivery quote for all these pieces, plus the other checkout charges you know. Amounts must be in {currency}. No delivery price is assumed.</p><div className="fit-filters"><label>Delivery quote ({currency})<input inputMode="decimal" type="number" min="0" max="10000" step="0.01" value={shipping} onChange={e=>setShipping(e.target.value)}/></label><label>Other charges ({currency})<input inputMode="decimal" type="number" min="0" max="10000" step="0.01" value={extras} onChange={e=>setExtras(e.target.value)}/></label></div><p role="status">{estimate===null?'Enter both amounts, including 0 only if you have confirmed no charge.':`Your estimate: ${money(estimate,currency)} ${currency}. Based on the item subtotal and your entered quotes; unquoted charges may still apply.`}</p><p>Your amounts stay on this page and aren’t sent to Insights.</p></details>;
}
function BuyingChecklist({look,onDemand}) {
 const [checked,setChecked]=useState({});
 return <details className="fit-checklist"><summary>Before you buy this look</summary>
  <p>Open each listing and confirm its size chart, color or style, current price and availability. These checks stay in this visit.</p>
  <ol>{look.pieces.map((piece,index)=><li key={piece.id}><label><input type="checkbox" checked={!!checked[piece.id]} disabled={!piece.item} onChange={e=>setChecked({...checked,[piece.id]:e.target.checked})}/> <span>{index+1}. {piece.role}{!piece.item?' · Unavailable':''}</span></label>{piece.item&&<a href={piece.item.link} target="_blank" rel="noopener noreferrer" onClick={()=>onDemand(piece.id,'click')}>Check {piece.item.name}</a>}</li>)}</ol>
  <p>Choose your seller options separately for each item. Check shipping, agent fees and any other checkout charges before paying. Saving the look keeps the selected products together.</p>
 </details>;
}
export default function ShopTheFit({looks,selectedLook,onSelect,wishlistSet,onSave,currency,rate,onDemand,audience,onViewSaved,onPreview,onBrowseIntent,collect,rateDate}) {
 const [message,setMessage]=useState(null),[filters,setFilters]=useState({occasion:'',layers:'',budget:''});
 const heading=useRef(null);
 const look=selectedLook||looks[0];
 const fitId=look?.id;
 const choices=filterLooks(looks,filters,currency,rate);
 const signal=(action,id)=>siteSignal({type:'fit',fit:fitId,action,...(id?{id}:{})});
 useEffect(()=>{
  if(!collect||!fitId||!heading.current)return;
  let timer,visible=false;
  const observe=()=>{clearTimeout(timer);if(visible&&document.visibilityState==='visible')timer=setTimeout(()=>siteSignal({type:'fit',fit:fitId,action:'view'}),1000);};
  const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting&&entries[0].intersectionRatio>=.5;observe();},{threshold:.5});
  observer.observe(heading.current);document.addEventListener('visibilitychange',observe);
  return()=>{observer.disconnect();clearTimeout(timer);document.removeEventListener('visibilitychange',observe);};
 },[collect,fitId,look?.swap,choices.length]);
 if(!look)return null;
 const matches=choices.some(option=>option.id===look.id);
 const total=lookTotal(look.pieces,currency,rate),usdTotal=lookTotal(look.pieces,'USD',rate);
 const allSaved=look.complete&&look.pieces.every(({id})=>wishlistSet.has(id));
 function choose(id){setMessage(null);onSelect(id);}
 function filter(key,value){
  const next={...filters,[key]:value};setFilters(next);
  const filtered=filterLooks(looks,next,currency,rate);
  if(filtered.length&&!filtered.some(option=>option.id===look.id))choose(filtered[0].id);
 }
 function swap(slot,id){setFilters({...filters,budget:''});setMessage(null);onSelect(look.id,swapValue(look,slot,id));}
 function save(){
  if(!look.complete)return;
  const result=onSave(look.pieces.map(p=>p.id));
  if(result.status==='saved')signal('save');
  setMessage({lookId:look.id,text:result.status==='full'?'Saved is full. Remove a few items, then save this look.':result.status==='already'?'Every piece is already in Saved.':`${result.added.length} ${result.added.length===1?'piece added':'pieces added'} to Saved.`});
 }
 const permalink=`?audience=${audience}&view=fits&fit=${look.id}${look.swap?'&swap='+encodeURIComponent(look.swap):''}#shop-the-fit`;
 return <section className="fit-section" id="shop-the-fit" aria-labelledby="fit-heading">
  <div className="fit-heading"><div><p className="discovery-eyebrow">PUT IT TOGETHER</p><h2 id="fit-heading">Build A Fit</h2></div><div className="fit-heading-aside"><p>Curated looks. Make them yours.</p><a href={`?audience=${audience}&view=all#catalogue`} onMouseEnter={onBrowseIntent} onFocus={onBrowseIntent}>Browse all finds</a></div></div>
  <p className="fit-intro">Curated outfits, with selected swaps where available. Photos show separate pieces; confirm colors and sizes at the seller.</p>
  <div className="fit-filters"><label>Occasion<select value={filters.occasion} onChange={e=>filter('occasion',e.target.value)}><option value="">All occasions</option>{['Everyday','Travel','Evening','Active'].map(value=><option key={value}>{value}</option>)}</select></label><label>Layers<select value={filters.layers} onChange={e=>filter('layers',e.target.value)}><option value="">All looks</option><option>Light</option><option>Layered</option></select></label><label>Item subtotal<select value={filters.budget} onChange={e=>filter('budget',e.target.value)}><option value="">Any budget</option><option value="100">Up to $100 {currency}</option><option value="150">Up to $150 {currency}</option></select></label></div>
  <div className="fit-picker" role="group" aria-label="Choose a look">{choices.map(option=><button key={option.id} type="button" aria-pressed={look.id===option.id} onClick={()=>choose(option.id)}><LookThumb piece={option.pieces[0]}/><span>{option.title}<small>{option.occasion}{!option.complete?' · Piece unavailable':''}</small></span></button>)}</div>
  {!choices.length?<div className="fit-empty" role="status"><p>No looks match these filters. Budgets use item prices before delivery and other charges.</p><button className="control" onClick={()=>setFilters({occasion:'',layers:'',budget:''})}>Show all looks</button></div>:<>
  {!matches&&<p className="fit-price-note">Your current look is outside these filters. Choose a matching look above or clear your filters.</p>}
  <div className="fit-layout" key={look.id+look.swap}>
   <div className={`fit-board${look.photoLayout?` fit-board-photo-led fit-board-${look.photoLayout}`:''}`} aria-label={`${look.title} outfit pieces`}>
    {look.pieces.map(({item,role,imageWidth,imageHeight},index)=>item?<a ref={index===0?heading:undefined} className={`fit-photo fit-photo-${index}`} key={item.id} data-product-id={item.id} href={item.link} target="_blank" rel="noopener noreferrer" aria-label={`Shop ${item.name}`} onClick={()=>onDemand(item.id,'click')}><FitPhoto item={item} width={imageWidth} height={imageHeight} priority={index===0}/><span className="fit-photo-label">{String(index+1).padStart(2,'0')} / {role}</span></a>:<div ref={index===0?heading:undefined} key={index} className={`fit-photo fit-photo-${index}`}><span className="fit-photo-fallback" style={{aspectRatio:`${imageWidth} / ${imageHeight}`}}>{role} · Listing unavailable</span></div>)}
    <span className="fit-board-note">Individual product photos · Choose colors & sizes at the seller</span>
   </div>
   <div className="fit-details">
    <p className="fit-audience">{look.audience==='everyone'?'For everyone':look.audience==='men'?'For men':'For women'} · {look.occasion}</p>
    <h3>{look.title}</h3><p className="fit-description">{look.swap?`${look.silhouette}. You’ve selected an alternative below.`:look.description}</p>
    {!look.complete&&<p className="fit-unavailable" role="status">This look has an unavailable listing. Choose an offered alternative or browse another look. Seller stock and sizes still need checking.</p>}
    <ol className="fit-pieces">{look.pieces.map((piece,index)=>{const {item,role}=piece;const amount=item?priceAmount(item,currency,rate):NaN;const base=piece.basePiece||piece;const options=[base,...(base.alternatives||[])];return <li key={index}><span className="fit-number">{String(index+1).padStart(2,'0')}</span>{item?<a href={item.link} target="_blank" rel="noopener noreferrer" onClick={()=>onDemand(item.id,'click')}><span className="fit-role">{role}</span><span>{item.name}</span></a>:<span className="fit-missing"><span className="fit-role">{role}</span>Listing unavailable</span>}{item&&<button className="fit-preview" onClick={()=>{onPreview(item);}} aria-label={`Quick View ${item.name}`}>Quick View</button>}<span className="fit-piece-price">{Number.isFinite(amount)?money(amount,currency):'See price'}</span>{options.length>1&&<label className="fit-swap">Choose this piece<select value={piece.id} onChange={e=>swap(index,e.target.value)}>{options.map(option=><option key={option.id} value={option.id} disabled={!option.item}>{option.item?.name||'Original listing unavailable'}{option.id===base.id?' · Original':''}</option>)}</select></label>}</li>;})}</ol>
    <div className="fit-total"><span>Item subtotal</span><strong>{total===null?'Check seller prices':`${money(total,currency)} ${currency}`}</strong></div>
    {currency==='CAD'&&usdTotal!==null&&<p className="fit-price-note">{money(usdTotal,'USD')} USD before conversion · Exchange rate dated {rateDate}</p>}
    <p className="fit-price-note">Item prices only. Shipping, agent fees, taxes and other checkout charges are extra. Each piece is purchased separately; confirm current prices and options at the seller.</p>
    {total!==null&&<DeliveryEstimate key={look.id+look.swap+currency} subtotal={total} currency={currency}/>}
    <BuyingChecklist key={look.id+look.swap} look={look} onDemand={onDemand}/>
    <button className="fit-save" type="button" onClick={save} disabled={!look.complete}>{!look.complete?'Complete this look before saving':allSaved?'✓ All pieces saved':'♡ Save the whole look'}</button>
    <a className="fit-permalink" href={permalink}>Link to this look</a>
    <p className="fit-feedback" role="status">{message?.lookId===look.id?message.text:''}</p>
    {allSaved&&<button type="button" className="fit-view-saved" onClick={onViewSaved}>View Saved</button>}
   </div>
  </div></>}
 </section>;
}
