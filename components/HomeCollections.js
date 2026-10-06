import { useEffect, useRef, useState } from 'react';
function Shelf({section,renderCard,audience,sectionIndex}) {
  const rail=useRef(null);
  const [position,setPosition]=useState(0);
  const [atEnd,setAtEnd]=useState(false);
  const [overflow,setOverflow]=useState(false);
  function measure() {
    const node=rail.current;
    setPosition(previous=>(previous<=3)===(node.scrollLeft<=3)?previous:node.scrollLeft);setAtEnd(node.scrollLeft+node.clientWidth>=node.scrollWidth-2);setOverflow(node.scrollWidth>node.clientWidth+2);
  }
  useEffect(()=>{
    rail.current.scrollLeft=0;measure();
    const observer=new ResizeObserver(measure);observer.observe(rail.current);
    return ()=>observer.disconnect();
  },[section.items]);
  const href=section.key==='explore'?'#catalogue':`?audience=${audience}&view=${section.key==='bought'?'bought':'all'}${section.key==='bought'?'':`&collection=${section.key}`}#catalogue`;
  function move(direction) {
    const node=rail.current;
    node.scrollBy({left:direction*node.clientWidth*.8,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  }
  return <section className="home-shelf" aria-labelledby={`shelf-${section.key}`}>
    <div className="shelf-heading"><div><h2 id={`shelf-${section.key}`}>{section.title}</h2><p>{section.description}</p></div><a className="shelf-all" href={href}>See all<span className="sr-only"> {section.title}</span></a></div>
    <div className="shelf-rail" ref={rail} onScroll={measure}>
      {section.items.map((item,index)=><div className="shelf-item" key={item.id}>{renderCard(item,index,sectionIndex)}</div>)}
    </div>
    {overflow && <div className="shelf-controls"><span>Scroll to explore</span><div><button type="button" aria-label={`Previous ${section.title} finds`} disabled={position<=3} onClick={()=>move(-1)}>Previous</button><button type="button" aria-label={`Next ${section.title} finds`} disabled={atEnd} onClick={()=>move(1)}>Next</button></div></div>}
  </section>;
}
export default function HomeCollections({sections,renderCard,audience}) {
  if(!sections.length)return null;
  return <div className="home-collections" aria-label="Featured collections">
    {sections.map((section,sectionIndex)=><Shelf sectionIndex={sectionIndex} key={`${audience}:${section.key}`} section={section} renderCard={renderCard} audience={audience}/>)}
  </div>;
}

export function HomeSkeleton(){return <div className="home-collections home-loading" role="status" aria-label="Loading collections"><span className="sr-only">Loading your finds…</span>{[0,1,2,3].map(n=><section className="home-shelf" key={n} aria-hidden="true"><div className="shelf-heading"><div className="shelf-skeleton-heading"/></div><div className="shelf-rail">{[0,1,2,3,4,5].map(i=><div className="shelf-item" key={i}><div className="skeleton-card"><div className="skeleton-image"/><div className="skeleton-copy"><div/><div/><div/></div></div></div>)}</div><div className="shelf-skeleton-controls"/></section>)}</div>;}
