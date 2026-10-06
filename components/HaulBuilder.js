import {useEffect,useMemo,useState,useRef} from 'react';
import {audienceFor} from '../lib/audience';
import {MAX_BOARDS,MAX_ITEMS,cleanBoards,cleanName,addToBoard,resolveHaul,subtotal,shareHash,readSharedHaul} from '../lib/haul-builder';
const KEY='zay-haul-boards-v1';
function HaulPhoto({item}) {
 const [failed,setFailed]=useState(false);
 let src=item.image;
 try{const url=new URL(src);if(url.hostname==='si.geilicdn.com')url.searchParams.set('w','400');src=url.toString();}catch{}
 return failed?<span className="haul-no-photo">View photo at seller</span>:<img src={src} alt={item.name} loading="lazy" onError={()=>setFailed(true)}/>;
}
export default function HaulBuilder({items,wishlist,onWishlist,onSave,currency,rate,audience,search,recent,onDemand,onBrowse,onPreview}) {
  const grid=useRef(null);
  const [boards,setBoards]=useState([]),[active,setActive]=useState('saved'),[selected,setSelected]=useState([]),[name,setName]=useState(''),[destination,setDestination]=useState(''),[message,setMessage]=useState(''),[share,setShare]=useState(''),[shared,setShared]=useState(null),[limit,setLimit]=useState(60),[deleted,setDeleted]=useState(null);
  useEffect(()=>{
    try{setBoards(cleanBoards(JSON.parse(localStorage.getItem(KEY)||'[]')));}catch{}
    const incoming=readSharedHaul(window.location.hash);
    if(incoming){setShared(incoming);setActive('shared');}
    else if(window.location.hash.startsWith('#haul='))setMessage('This haul link is invalid or incomplete. Your saved finds are unchanged.');
  },[]);
  useEffect(()=>{setSelected([]);setLimit(60);},[audience,search]);
  function persist(next){setBoards(next);try{localStorage.setItem(KEY,JSON.stringify(next));return true;}catch{setMessage('Your changes work for this visit, but this browser could not save them. Copy a haul link to keep them.');return false;}}
  function change(id){setActive(id);setSelected([]);setMessage('');setShare('');setLimit(60);}
  const board=boards.find(b=>b.id===active);
  const ids=active==='shared'?shared?.ids||[]:active==='recent'?recent:board?board.ids:wishlist;
  const all=useMemo(()=>resolveHaul(ids,items),[ids,items]);
  const scoped=all.filter(item=>audience==='everyone'||audienceFor(item)==='everyone'||audienceFor(item)===audience);
  const shown=scoped.filter(item=>!search.trim()||`${item.name} ${(item.categories||[]).join(' ')}`.toLowerCase().includes(search.trim().toLowerCase()));
  const exposureKey=shown.slice(0,limit).map(i=>i.id).join(',');
  useEffect(()=>{
    if(!window.IntersectionObserver)return;
    const timers=new Map();
    const observer=new IntersectionObserver(entries=>{for(const entry of entries){
      clearTimeout(timers.get(entry.target));timers.delete(entry.target);
      if(entry.isIntersecting&&entry.intersectionRatio>=.5&&document.visibilityState==='visible')timers.set(entry.target,setTimeout(()=>onDemand(entry.target.dataset.productId,'view'),1000));
    }},{threshold:.5});
    const observe=()=>{for(const timer of timers.values())clearTimeout(timer);timers.clear();observer.disconnect();if(document.visibilityState==='visible')grid.current?.querySelectorAll('[data-product-id]').forEach(node=>observer.observe(node));};
    observe();document.addEventListener('visibilitychange',observe);
    return()=>{observer.disconnect();for(const timer of timers.values())clearTimeout(timer);document.removeEventListener('visibilitychange',observe);};
  },[exposureKey,onDemand]);
  const total=subtotal(all,currency,rate), hidden=all.length-scoped.length, unavailable=ids.length-all.length;
  const title=active==='shared'?shared?.name:active==='recent'?'Recently opened':board?.name||'All saved finds';
  const money=value=>(currency==='CAD'?'≈ ':'')+new Intl.NumberFormat('en-US',{style:'currency',currency}).format(value);
  function create(){
    const label=cleanName(name);if(!label){setMessage('Give your haul a name first.');return;}
    if(boards.length>=MAX_BOARDS){setMessage('You can keep up to 20 hauls. Delete an old board to make room.');return;}
    const next={id:'haul-'+crypto.randomUUID(),name:label,ids:selected.slice(0,MAX_ITEMS)};
    const saved=persist([...boards,next]);setName('');change(next.id);if(!saved)setMessage('This haul is only saved for this visit. Copy its link to keep it.');
  }
  function add(){
    const target=boards.find(b=>b.id===destination);if(!target||!selected.length){setMessage('Select finds and choose a haul first.');return;}
    const result=addToBoard(target,selected);if(result.status==='full'){setMessage(`Each haul holds up to ${MAX_ITEMS} finds. Nothing was added.`);return;}
    if(persist(boards.map(b=>b.id===target.id?result.board:b)))setMessage(result.status==='already'?'Those finds are already in this haul.':`Added to ${target.name}.`);setSelected([]);
  }
  function makeShare(){
    if(!all.length)return;
    if(all.length>MAX_ITEMS){setMessage('Choose a haul of up to 100 finds to share.');return;}
    const hash=shareHash({name:title,ids:all.map(i=>i.id)});
    setShare(`${window.location.origin}/?view=saved&audience=everyone${hash}`);setMessage('This link shares these finds and the haul name. Future edits will not change it.');
  }
  function importShared(){
    if(boards.length>=MAX_BOARDS){setMessage('You can keep up to 20 hauls. Delete an old board first.');return;}
    const result=onSave(all.map(i=>i.id));if(result.status==='full'){setMessage('Saved is full. Remove some saved finds first.');return;}
    const next={id:'haul-'+crypto.randomUUID(),name:shared.name,ids:all.map(i=>i.id)};
    const saved=persist([...boards,next]);change(next.id);setMessage(saved?'A copy is now in your hauls.':'This copy is only saved for this visit.');
  }
  return <section className="haul-builder" aria-labelledby="haul-heading">
    <div className="haul-heading"><div><p className="discovery-eyebrow">YOUR FINDS, YOUR PLANS</p><h2 id="haul-heading">Haul Builder</h2><p>Save finds, group your favorites, and plan your next haul.</p></div><button className="control" onClick={onBrowse}>Browse finds</button></div>
    <p className="haul-note">No account needed. Your saved finds and boards stay in this browser.</p>
    <div className="haul-tabs" role="group" aria-label="Choose a haul">
      <button className="control" aria-pressed={active==='saved'} onClick={()=>change('saved')}>All saved ({wishlist.length})</button>
      {boards.map(b=><button className="control" key={b.id} aria-pressed={active===b.id} onClick={()=>change(b.id)}>{b.name} ({b.ids.length})</button>)}
      <button className="control" aria-pressed={active==='recent'} onClick={()=>change('recent')}>Recently opened</button>
      {shared&&<button className="control" aria-pressed={active==='shared'} onClick={()=>change('shared')}>Shared haul</button>}
    </div>
    <details className="haul-organize"><summary>Create or organize a haul</summary>
      <form onSubmit={event=>{event.preventDefault();create();}}><label>New haul name<input value={name} maxLength={60} onChange={e=>setName(e.target.value)} placeholder="Weekend fits, holiday haul…"/></label><button className="control" type="submit">Create haul{selected.length?` with ${selected.length} selected`:''}</button></form>
      {boards.length>0&&<div className="haul-add"><label>Add selected finds to<select value={destination} onChange={e=>setDestination(e.target.value)}><option value="">Choose a haul</option>{boards.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label><button className="control" disabled={!selected.length||!destination} onClick={add}>Add {selected.length||''} selected</button></div>}
      <p className="haul-note">Select finds below, then create a haul or add them to an existing one. Each haul holds up to 100 finds.</p>
      {board&&<div className="haul-board-actions"><button className="control" onClick={()=>{const label=cleanName(name);if(!label){setMessage('Enter the new name above first.');return;}if(persist(boards.map(b=>b.id===board.id?{...b,name:label}:b)))setMessage('Haul renamed.');setName('');setShare('');}}>Rename this haul</button><button className="control" onClick={()=>{const removed=board;const ok=persist(boards.filter(b=>b.id!==board.id));change('saved');setDeleted(removed);setMessage(ok?'Haul deleted. Your saved finds are unchanged.':'Deletion could not be saved in this browser.');}}>Delete this haul</button></div>}
    </details>
    <div className="haul-summary"><div><h3>{title}</h3><p>{all.length} {all.length===1?'find':'finds'} · one of each</p></div><div><span>{total.unknown?'Known item subtotal':'Item subtotal'}</span><strong>{money(total.amount)} {currency}</strong></div></div>
    <p className="haul-note">Shipping, agent fees and other checkout charges are extra. Confirm prices and options at the seller.{total.unknown>0?` ${total.unknown} item price${total.unknown===1?' is':'s are'} unknown and excluded.`:''}{unavailable>0?` ${unavailable} unavailable find${unavailable===1?' is':'s are'} excluded.`:''}{hidden>0?` ${hidden} find${hidden===1?' is':'s are'} outside this audience filter; the subtotal includes the whole haul.`:''}</p>
    <div className="haul-tools"><button className="control" onClick={makeShare} disabled={!all.length||active==='recent'}>Share {board||active==='shared'?'haul':'saved finds'}</button>{active==='shared'&&<button className="control" disabled={!all.length} onClick={importShared}>Save a copy of this haul</button>}{selected.length>0&&<button className="control" onClick={()=>setSelected([])}>Clear selection ({selected.length})</button>}</div>
    {share&&<div className="haul-share"><label>Shareable haul link<input readOnly value={share} onFocus={e=>e.target.select()}/></label><button className="control" onClick={async()=>{try{await navigator.clipboard.writeText(share);setMessage('Haul link copied.');}catch{setMessage('Select the link above and copy it manually.');}}}>Copy link</button></div>}
    <p role="status" className="haul-feedback">{message}</p>{deleted&&<button className="control" onClick={()=>{if(boards.length>=MAX_BOARDS){setMessage('Delete a board before restoring this haul.');return;}if(persist([...boards,deleted])){setMessage('Haul restored.');setDeleted(null);}}}>Undo delete {deleted.name}</button>}
    {!shown.length&&<p className="haul-empty">{search?'No finds match your search.':hidden?'Choose Everyone to see all finds in this haul.':active==='recent'?'Products you preview or open at the seller will appear here.':board?'This haul is empty. Go to All saved, select some finds, and add them to this haul.':'Tap a heart on any product to save it here.'}</p>}
    <div className="haul-grid" ref={grid}>{shown.slice(0,limit).map(item=><article className="haul-item" key={item.id} data-product-id={item.id}>
      <label className="haul-select"><input type="checkbox" checked={selected.includes(item.id)} onChange={e=>{if(e.target.checked&&selected.length>=MAX_ITEMS){setMessage('Select up to 100 finds at a time.');return;}setSelected(e.target.checked?[...selected,item.id]:selected.filter(id=>id!==item.id));}}/>Select <span className="sr-only">{item.name}</span></label>
      <a href={item.link} target="_blank" rel="noopener noreferrer" onClick={()=>onDemand(item.id,'click')}>{item.image?<HaulPhoto item={item}/>:<span className="haul-no-photo">View photo at seller</span>}<h4>{item.name}</h4></a>
      <p>{subtotal([item],currency,rate).unknown?'Check seller price':money(subtotal([item],currency,rate).amount)}</p>
      <a className="haul-seller" href={item.link} target="_blank" rel="noopener noreferrer" onClick={()=>onDemand(item.id,'click')}>View on Kakobuy</a>
      <div className="haul-item-actions"><button className="control" onClick={()=>onPreview(item)} aria-label={`Quick View ${item.name}`}>Quick View</button><button className="control" onClick={()=>{onWishlist(item.id);if(!wishlist.includes(item.id))onDemand(item.id,'save');}}>{wishlist.includes(item.id)?'Saved · Remove':'Save find'}</button>{board&&<button className="control" onClick={()=>{persist(boards.map(b=>b.id===board.id?{...b,ids:b.ids.filter(id=>id!==item.id)}:b));setSelected(selected.filter(id=>id!==item.id));setShare('');}}>Remove from haul</button>}</div>
    </article>)}</div>
    {shown.length>limit&&<button className="control" onClick={()=>setLimit(limit+60)}>Load more finds</button>}
  </section>;
}
