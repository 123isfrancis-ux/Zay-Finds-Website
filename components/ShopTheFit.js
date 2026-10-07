import {fitImage,fitImageSet} from '../lib/catalogue-delivery';
import {siteSignal} from '../lib/site-signals';
import { useState } from 'react';
import { lookTotal } from '../lib/shop-the-fit';
import { priceAmount } from '../lib/catalogue';
function money(amount,currency) {return (currency==='CAD'?'≈ ':'')+new Intl.NumberFormat('en-US',{style:'currency',currency}).format(amount);}
function FitPhoto({item,width,height,priority}) {
  const [failed,setFailed]=useState(false);
  const [original,setOriginal]=useState(false);
  const sizes=priority
    ? '(max-width: 640px) calc((100vw - 60px) * 0.66), (max-width: 900px) calc((100vw - 84px) * 0.66), (max-width: 1248px) calc((100vw - 84px) * 0.36), 430px'
    : '(max-width: 640px) calc((100vw - 60px) * 0.33), (max-width: 900px) calc((100vw - 84px) * 0.33), (max-width: 1248px) calc((100vw - 84px) * 0.18), 215px';
  return failed?<span className="fit-photo-fallback" style={{aspectRatio:`${width} / ${height}`}}>View photo at seller</span>:<img src={fitImage(item.image,600,!original)} srcSet={original?undefined:fitImageSet(item.image)} sizes={sizes} alt={item.name} width={width} height={height} loading={priority?"eager":"lazy"} fetchPriority={priority?"high":"auto"} decoding="async" onError={()=>{if(!original && fitImage(item.image)!==fitImage(item.image,600,false)){setOriginal(true);return;}setFailed(true);siteSignal({type:'image_error',id:item.id});}}/>;
}
export default function ShopTheFit({looks,selectedId,onSelect,wishlistSet,onSave,currency,rate,onDemand,audience,onViewSaved,onPreview}) {
  const [message,setMessage]=useState(null);
  if(!looks.length)return null;
  const look=looks.find(look=>look.id===selectedId)||looks[0];
  const allSaved=look.pieces.every(({id})=>wishlistSet.has(id));
  const total=lookTotal(look.pieces,currency,rate);
  const usdTotal=lookTotal(look.pieces,'USD',rate);
  function save() {
    const result=onSave(look.pieces.map(p=>p.id));
    setMessage({lookId:look.id,text:result.status==='full'?'Saved is full. Remove a few items, then save this look.':result.status==='already'?'Every piece is already in Saved.':`${result.added.length} ${result.added.length===1?'piece added':'pieces added'} to Saved.`});
  }
  return <section className="fit-section" id="shop-the-fit" aria-labelledby="fit-heading">
    <div className="fit-heading"><div><p className="discovery-eyebrow">PUT IT TOGETHER</p><h2 id="fit-heading">Build A Fit</h2></div><div className="fit-heading-aside"><p>One look. Every piece.</p><a href={`?audience=${audience}&view=all#catalogue`}>Browse all finds</a></div></div>
    <div className="fit-picker" role="group" aria-label="Choose a look">{looks.map(option=><button key={option.id} type="button" aria-pressed={look.id===option.id} onClick={()=>{setMessage('');onSelect(option.id);}}>{option.title}</button>)}</div>
    <div className="fit-layout" key={look.id}>
      <div className={`fit-board${look.photoLayout ? ` fit-board-photo-led fit-board-${look.photoLayout}` : ''}`} aria-label={`${look.title} outfit pieces`}>
        {look.pieces.map(({item,role,imageWidth,imageHeight},index)=><a className={`fit-photo fit-photo-${index}`} key={item.id} data-product-id={item.id} href={item.link} target="_blank" rel="noopener noreferrer" aria-label={`Shop ${item.name}`} onClick={()=>onDemand(item.id,'click')}><FitPhoto item={item} width={imageWidth} height={imageHeight} priority={index===0}/><span className="fit-photo-label">{String(index+1).padStart(2,'0')} / {role}</span></a>)}
        <span className="fit-board-note">Style inspiration · Choose colors & sizes at the seller</span>
      </div>
      <div className="fit-details">
        <p className="fit-audience">{look.audience==='everyone'?'For everyone':look.audience==='men'?'For men':'For women'}</p>
        <h3>{look.title}</h3><p className="fit-description">{look.description}</p>
        <ol className="fit-pieces">{look.pieces.map(({item,role},index)=>{const amount=priceAmount(item,currency,rate);return <li key={item.id}><span className="fit-number">{String(index+1).padStart(2,'0')}</span><a href={item.link} target="_blank" rel="noopener noreferrer" onClick={()=>onDemand(item.id,'click')}><span className="fit-role">{role}</span><span>{item.name}</span></a><button className="fit-preview" onClick={()=>onPreview(item)} aria-label={`Quick View ${item.name}`}>Quick View</button><span className="fit-piece-price">{Number.isFinite(amount)?money(amount,currency):'See price'}</span></li>;})}</ol>
        <div className="fit-total"><span>Combined item price</span><strong>{total===null?'Check seller prices':`${money(total,currency)} ${currency}`}</strong></div>
        {currency==='CAD'&&usdTotal!==null&&<p className="fit-price-note">{money(usdTotal,'USD')} USD before conversion</p>}
        <p className="fit-price-note">Shipping extra. Each piece is purchased separately; prices and options may vary.</p>
        <button className="fit-save" type="button" onClick={save}>{allSaved?'✓ All pieces saved':'♡ Save the whole look'}</button>
        <a className="fit-permalink" href={`?audience=${audience}&view=fits&fit=${look.id}#shop-the-fit`}>Link to this look</a>
        <p className="fit-feedback" role="status">{message?.lookId===look.id?message.text:''}</p>
        {allSaved&&<button type="button" className="fit-view-saved" onClick={onViewSaved}>View Saved</button>}
      </div>
    </div>
  </section>;
}
