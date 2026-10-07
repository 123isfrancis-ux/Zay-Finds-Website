import { useEffect, useRef, useState } from 'react';
export default function MobileFilters({categories,category,sort,recommendedLabel,onApply}) {
  const dialog=useRef(null),trigger=useRef(null);
  const [draftCategory,setDraftCategory]=useState(category);
  const [draftSort,setDraftSort]=useState(sort);
  useEffect(()=>{
    const query=window.matchMedia('(max-width:640px)');
    const resized=()=>{if(!query.matches)dialog.current?.close();};
    query.addEventListener('change',resized);
    return ()=>{query.removeEventListener('change',resized);dialog.current?.close();};
  },[]);
  const active=Boolean(category)||sort!=='trending';
  function close(){dialog.current.close();trigger.current.focus();}
  return <div className="mobile-filters">
    <button className="control mobile-filter-trigger" ref={trigger} type="button" aria-haspopup="dialog" onClick={()=>{setDraftCategory(category);setDraftSort(sort);dialog.current.showModal();}}>Filter &amp; Sort{active&&<span className="filter-active" aria-label="Filters active">•</span>}</button>
    <dialog className="category-sheet mobile-filter-dialog" ref={dialog} aria-labelledby="mobile-filter-title" onCancel={()=>trigger.current.focus()} onClick={e=>{if(e.target===dialog.current)close();}}>
      <div className="sheet-content">
        <div className="sheet-heading"><h2 id="mobile-filter-title">Filter &amp; Sort</h2><button type="button" className="control" aria-label="Close filters" onClick={close}>×</button></div>
        <div className="mobile-filter-options">
          <label className="mobile-filter-field">Category<select aria-label="Filter category" value={draftCategory} onChange={e=>setDraftCategory(e.target.value)}><option value="">All categories</option>{categories.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}</select></label>
          <label className="mobile-filter-field">Sort<select aria-label="Filter sort" value={draftSort} onChange={e=>setDraftSort(e.target.value)}><option value="trending">{recommendedLabel}</option><option value="default">Sheet order</option><option value="price-asc">Price: Low to High</option><option value="price-desc">Price: High to Low</option><option value="name">Name: A to Z</option></select></label>
        </div>
        <div className="sheet-actions"><button type="button" className="control" onClick={()=>{setDraftCategory('');setDraftSort('trending');}}>Reset</button><button type="button" className="control primary" onClick={()=>{onApply(draftCategory,draftSort);close();}}>Apply</button></div>
      </div>
    </dialog>
  </div>;
}
