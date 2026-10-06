import {useEffect,useRef,useState} from 'react';
import {priceAmount} from '../lib/catalogue';
import {relatedFinds} from '../lib/quick-view';
function Photo({item}) {
 const [failed,setFailed]=useState(false);
 let src=item.image;
 try{const url=new URL(src,window.location.origin);if(url.hostname==='si.geilicdn.com'){url.searchParams.set('w','900');url.searchParams.delete('h');}src=url.toString();}catch{}
 return src&&!failed?<img src={src} alt={item.name} onError={()=>setFailed(true)}/>:<div className="quick-photo-fallback">Photos are available at the seller.</div>;
}
export default function QuickView({item,items,currency,rate,audience,wishlist,onWishlist,onSelect,onClose,onDemand}) {
 const dialog=useRef(null),content=useRef(null),closeButton=useRef(null);
 useEffect(()=>{
  const opener=document.activeElement,scrollY=window.scrollY,body=document.body;
  const previous={position:body.style.position,top:body.style.top,width:body.style.width,overflow:body.style.overflow};
  body.style.position='fixed';body.style.top=`-${scrollY}px`;body.style.width='100%';body.style.overflow='hidden';
  dialog.current.showModal();
  return()=>{Object.assign(body.style,previous);window.scrollTo(0,scrollY);if(opener?.isConnected)opener.focus({preventScroll:true});};
 },[]);
 useEffect(()=>{content.current?.scrollTo(0,0);closeButton.current?.focus({preventScroll:true});},[item.id]);
 useEffect(()=>{let timer;const observe=()=>{clearTimeout(timer);if(document.visibilityState==='visible')timer=setTimeout(()=>onDemand(item.id,'view'),1000);};observe();document.addEventListener('visibilitychange',observe);return()=>{clearTimeout(timer);document.removeEventListener('visibilitychange',observe);};},[item.id,onDemand]);
 const related=relatedFinds(item,items,audience);
 const amount=priceAmount(item,currency,rate);
 const price=Number.isFinite(amount)?`${currency==='CAD'?'≈ ':''}${new Intl.NumberFormat('en-US',{style:'currency',currency}).format(amount)} ${currency}`:'Check seller price';
 const saved=wishlist.has(item.id);
 return <dialog className="quick-dialog" ref={dialog} aria-labelledby="quick-title" onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(e.target===dialog.current)onClose();}}>
  <div className="quick-shell"><header className="quick-header"><span>Quick View</span><button ref={closeButton} className="control" aria-label="Close Quick View" onClick={onClose}>Close</button></header>
  <div className="quick-scroll" ref={content}>
   <div className="quick-product"><div className="quick-photo"><Photo key={item.id} item={item}/></div><div className="quick-info">
    <p className="quick-category">{(item.categories||[item.category]).filter(c=>c&&c.toLowerCase()!=='main').join(' · ')}</p>
    <h2 id="quick-title">{item.name}</h2>
    {item.personallyBought&&<p className="personally-bought">✓ Personally Bought</p>}
    {item.image?.startsWith('/owner-photos/')&&<p className="quick-note">Zay’s own photo</p>}
    <strong className="quick-price">{price}</strong><p className="quick-note">Item price only. Shipping and other checkout charges are extra. Confirm sizes, colors and current prices at the seller.</p>
    <div className="quick-actions"><button className="control" aria-pressed={saved} onClick={()=>{if(!saved)onDemand(item.id,'save');onWishlist(item.id);}}>{saved?'Saved · Remove':'Save find'}</button><a className="control quick-buy" href={item.link} target="_blank" rel="noopener noreferrer" onClick={()=>onDemand(item.id,'click')}>{item.link?.includes('kakobuy.com')?'View on Kakobuy':'View at seller'}</a></div>
   </div></div>
   {related.length>0&&<section className="quick-related" aria-label="Related finds"><h3>Related finds</h3><div>{related.map(product=><button type="button" key={product.id} onClick={()=>onSelect(product)} aria-label={`Preview ${product.name}`}><Photo key={product.id} item={product}/><span>{product.name}</span></button>)}</div></section>}
  </div></div>
 </dialog>;
}
