import { useEffect, useRef, useState } from 'react';
function Shelf({section,renderCard,audience}) {
  const rail=useRef(null);
  const [position,setPosition]=useState(0);
  const [atEnd,setAtEnd]=useState(false);
  const [overflow,setOverflow]=useState(false);
  function measure() {
    const node=rail.current;
    setPosition(node.scrollLeft);setAtEnd(node.scrollLeft+node.clientWidth>=node.scrollWidth-2);setOverflow(node.scrollWidth>node.clientWidth+2);
  }
  useEffect(()=>{
    rail.current.scrollLeft=0;measure();
    const observer=new ResizeObserver(measure);observer.observe(rail.current);
    return ()=>observer.disconnect();
  },[section.items]);
  const href=section.key==='explore'?`/shop?audience=${audience}`:`/shop?audience=${audience}&view=${section.key==='bought'?'bought':'all'}${section.key==='bought'?'':`&collection=${section.key}`}#catalogue`;
  function move(direction) {
    const node=rail.current;
    node.scrollBy({left:direction*node.clientWidth*.8,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  }
  return <section className="home-shelf" aria-labelledby={`shelf-${section.key}`}>
    <div className="shelf-heading"><div><h2 id={`shelf-${section.key}`}>{section.title}</h2><p>{section.description}</p></div><a className="shelf-all" href={href}>See all<span className="sr-only"> {section.title}</span> ↗</a></div>
    <div className="shelf-rail" ref={rail} onScroll={measure}>
      {section.items.map((item,index)=><div className="shelf-item" key={item.id}>{renderCard(item,index)}</div>)}
    </div>
    {overflow && <div className="shelf-controls"><span>Scroll to explore</span><div><button type="button" aria-label={`Previous ${section.title} finds`} disabled={position<=3} onClick={()=>move(-1)}>←</button><button type="button" aria-label={`Next ${section.title} finds`} disabled={atEnd} onClick={()=>move(1)}>→</button></div></div>}
  </section>;
}
export default function HomeCollections({sections,renderCard,audience}) {
  if(!sections.length)return null;
  return <div className="home-collections" aria-label="Featured collections">
    {sections.map(section=><Shelf key={`${audience}:${section.key}`} section={section} renderCard={renderCard} audience={audience}/>)}
  </div>;
}
