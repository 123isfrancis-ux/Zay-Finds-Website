import { useState, useEffect, useMemo, useCallback, useDeferredValue, useRef, memo } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import {restoreSearchFields,cardImage,boundedRanking} from '../lib/catalogue-delivery';
import {siteSignal,setSignalsEnabled} from '../lib/site-signals';
const QuickView = dynamic(()=>import('../components/QuickView'));
const HaulBuilder = dynamic(()=>import('../components/HaulBuilder'));
import {cleanIds} from '../lib/haul-builder';
const ShopTheFit = dynamic(()=>import('../components/ShopTheFit'));
import { availableLooks, saveLook } from '../lib/shop-the-fit';
import HomeCollections, {HomeSkeleton} from '../components/HomeCollections';
import { normalizeCollection, collectionItems, homeSections } from '../lib/home-collections';
import { rankRecommended } from '../lib/trending';
import { loadTrending } from '../lib/demand-client';
import useDemandTracking from '../hooks/useDemandTracking';
import { audienceFor, normalizeAudience, audienceFromQuery } from '../lib/audience';
import initialExchangeRate from '../data/exchange-rate.json';
import { track } from '@vercel/analytics';
import BuyingGuide from '../components/BuyingGuide';
import MobileBuyingHelp from '../components/MobileBuyingHelp';
import MobileFilters from '../components/MobileFilters';
import { useRouter } from 'next/router';
import SocialLinks from '../components/SocialLinks';
import CategoryFilter from '../components/CategoryFilter';
import { viewItems, categoriesFor, filterAndSort, catalogueFiltersFromQuery, priceAmount } from '../lib/catalogue';

const PAGE_SIZE = 24;

const CURRENCIES = ['USD', 'CAD'];
function record(name, data) { try { track(name, data); } catch {} }

const WISHLIST_KEY = 'zay-wishlist-v1';
const WISHLIST_MAX = 500;

// Whatever is in localStorage has to be treated as untrusted input: it persists
// for years, anything on this origin can write it, and it survives reloads. An
// unguarded JSON.parse here used to throw during hydration and blank the whole
// page — permanently, because the bad value was still there on the next load.
function loadWishlist() {
  try {
    const raw = localStorage.getItem(WISHLIST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(id => typeof id === 'string' && id.length > 0 && id.length <= 64)
      .slice(0, WISHLIST_MAX);
  } catch {
    return [];
  }
}

function saveWishlist(ids) {
  try {
    localStorage.setItem(WISHLIST_KEY, JSON.stringify(ids));
  } catch {
    // Quota exhausted, or storage blocked entirely (private mode, some embedded
    // webviews). The wishlist still works for this session, it just won't persist.
  }
}




// Badge colours live in globals.css (.badge-*) so they can be redefined for
// dark mode — see the note there.
const BADGE_CATEGORIES = ['Jackets', 'Hoodies', 'Shirts', 'Pants', 'Shoes', 'Bags', 'Decor', 'Accessories', 'Womens'];

function Badge({ cat }) {
  const known = BADGE_CATEGORIES.some(value => value.toLowerCase() === cat.toLowerCase());
  return (
    <span className={known ? `badge badge-${cat.toLowerCase()}` : 'badge'}>
      {cat}
    </span>
  );
}

const ItemCard = memo(function ItemCard({ item, wishlisted, onWishlist, currency, priority, usdToCad, onDemand, onPreview }) {
  const [imgError, setImgError] = useState(false);
  const [originalImage,setOriginalImage]=useState(false);
  const photoTarget=useRef(null);
  const [loadPhoto,setLoadPhoto]=useState(priority);
  useEffect(()=>{
    if(loadPhoto)return;
    if(priority||!window.IntersectionObserver){setLoadPhoto(true);return;}
    const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){setLoadPhoto(true);observer.disconnect();}},{rootMargin:'180px'});
    if(photoTarget.current)observer.observe(photoTarget.current);
    return()=>observer.disconnect();
  },[loadPhoto,priority]);

  const amount = priceAmount(item, currency, usdToCad);
  const displayPrice = Number.isFinite(amount)
    ? (currency === 'CAD' ? '≈ ' : '') + new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
    : 'See item price';
  const subPrice = currency === 'CAD' && Number.isFinite(item.prices?.USD)
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(item.prices.USD) + ' USD'
    : null;

  return (
    <div
      className="card"
      ref={photoTarget}
      data-product-id={item.id}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {item.link && <a className="card-link" href={item.link} target="_blank" rel="noopener noreferrer" aria-label={`Shop ${item.name}`} onClick={() => { record('product_click', { product: item.id, category: item.category }); onDemand(item.id, 'click'); }} />}
      <button className="card-mobile-preview" type="button" aria-label={`Preview ${item.name}`} aria-haspopup="dialog" onClick={()=>onPreview(item)} />
      {/* Image */}
      <div style={{ position: 'relative', width: '100%', paddingBottom: '100%', background: 'var(--cream)', overflow: 'hidden' }}>
        {item.image && !imgError ? (
          <img
            className="card-img"
            src={loadPhoto?cardImage(item.image,!originalImage):undefined}
            alt={item.name}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            decoding="async"
            onError={() => {if(!originalImage && cardImage(item.image)!==cardImage(item.image,false)){setOriginalImage(true);return;}setImgError(true);siteSignal({type:'image_error',id:item.id});}}
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              objectFit: item.image?.startsWith('/owner-photos/') ? 'contain' : 'cover',
              background: item.image?.startsWith('/owner-photos/') ? '#fff' : undefined,
            }}
          />
        ) : (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: 'var(--border)', fontSize: '32px',
          }}>
            <span className="photo-placeholder"><span>Z.</span><small>View photos at seller</small></span>
          </div>
        )}
        {/* Wishlist button */}
        <button
          onClick={event => { event.stopPropagation(); if (!wishlisted) onDemand(item.id, 'save'); onWishlist(item.id); }}
          type="button"
          className="wishlist-button"
          aria-pressed={wishlisted}
          style={{
            position: 'absolute', top: '10px', right: '10px',
            background: 'var(--float)', border: 'none', color: 'var(--ink)',
            borderRadius: '50%', width: '46px', height: '46px', zIndex: 2,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontSize: '16px',
            boxShadow: 'var(--shadow-float)',
            transition: 'transform 0.15s ease',
            transform: 'scale(1)',
          }}
          aria-label={`${wishlisted ? 'Remove' : 'Save'} ${item.name}${wishlisted ? ' from Saved' : ''}`}
        >
          {wishlisted ? '♥' : '♡'}
        </button>
      </div>

      {/* Info */}
      <div className="card-copy" style={{ padding: '14px 14px 16px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
        <div className="card-title-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
          <p className="product-name" style={{ fontSize: '13px', fontWeight: 400, color: 'var(--ink)', lineHeight: 1.4, flex: 1 }}>
            {item.name}
          </p>
          {item.personallyBought && <span className="personally-bought"><span aria-hidden="true">✓</span> Personally Bought</span>}
          {item.category?.toLowerCase() !== 'main' && <Badge cat={item.category} />}
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 'auto' }}>
          <div className="product-prices">
            <span style={{ fontSize: '17px', fontFamily: 'var(--font-playfair), serif', fontWeight: 500, color: 'var(--ink)' }}>
              {displayPrice}
            </span>
            {subPrice && (
              <span style={{ fontSize: '11px', color: 'var(--muted)', marginLeft: '6px' }}>
                {subPrice}
              </span>
            )}
          </div>

        </div>
        <span className="shop-label">{item.link?.includes('kakobuy.com') ? 'View on Kakobuy' : 'View at seller'}</span>
        <button className="card-quick-view" type="button" onClick={()=>onPreview(item)} aria-label={`Quick View ${item.name}`}>Quick View</button>
      </div>
    </div>
  );
});

export default function Home() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [collectionOrder, setCollectionOrder] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [collection, setCollection] = useState('');
  const [audience, setAudience] = useState('everyone');
  const initialAudience = useRef(null);
  const [currency, setCurrency] = useState('USD');
  const [exchangeRate, setExchangeRate] = useState(initialExchangeRate);
  const [wishlist, setWishlist] = useState([]);
  const [recent, setRecent] = useState([]);
  const [previewItem,setPreviewItem]=useState(null);
  const [view, setView] = useState(null);
  const [sortBy, setSortBy] = useState('trending');
  const [demand, setDemand] = useState({status:'disabled',scores:{},collect:false});
  useEffect(()=>{setSignalsEnabled(demand.collect);return()=>setSignalsEnabled(false);},[demand.collect]);
  const [page, setPage] = useState({ list: null, count: PAGE_SIZE });
  const [urlFiltersReady, setUrlFiltersReady] = useState(false);

  // TODO: Give categories stable IDs/slugs so shared links survive future label changes.
  // TODO: Consider adding a Copy link button for the currently selected view/category.
  useEffect(() => {
    if (!router.isReady) return;
    const filters = catalogueFiltersFromQuery(router.query);
    if (initialAudience.current === null) {
      try { initialAudience.current = normalizeAudience(localStorage.getItem('zay-audience')); } catch { initialAudience.current = 'everyone'; }
    }
    const nextAudience = audienceFromQuery(router.query.audience, initialAudience.current);
    setAudience(nextAudience);
    try { localStorage.setItem('zay-audience', nextAudience); } catch {}
    setView(router.query.fit ? 'fits' : filters.view || 'all');
    setCategory(filters.category);
    setCollection(!filters.view || filters.view === 'all' ? normalizeCollection(router.query.collection) : '');
    setUrlFiltersReady(true);
  }, [router.isReady, router.query.view, router.query.category, router.query.audience, router.query.collection, router.query.fit]);

  const updateFiltersInUrl = useCallback((nextView, nextCategory, nextAudience = audience, nextCollection = '') => {
    if (!router.isReady) return;
    const query = { ...router.query, audience: nextAudience };
    delete query.fit;
    if (nextCollection) query.collection = nextCollection;
    else delete query.collection;
    if (nextView) query.view = nextView;
    else delete query.view;
    if (nextCategory) query.category = nextCategory;
    else delete query.category;
    void router.push({ pathname: router.pathname, query }, undefined, { shallow: true, scroll: false });
  }, [router, audience]);

  // Keeps the input responsive while the grid catches up on a big filter pass.
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 20000);
    setLoading(true);
    setError('');
    setItems([]);
    async function load() {
      try {
        const rankingRequest=loadTrending();
        const response=await fetch('/api/catalogue?compact=2', { signal: controller.signal, cache: 'default' });
        if (!response.ok) throw new Error('Catalogue request failed');
        const { items: deliveredRows, collections } = await response.json();
        const rows=restoreSearchFields(deliveredRows);
        const snapshot=await boundedRanking(rankingRequest);
        if (!active) return;
        setDemand(snapshot);
        setItems(rows);
        setCollectionOrder(collections || []);
        setView(previous => previous || (rows.some(item => item.visibility === 'weekly') ? 'week' : 'all'));
      } catch (failure) {
        if (active && (failure.name !== 'AbortError' || timedOut)) {
          setError('We couldn’t load the catalogue. Please try again.');
        }
      } finally {
        clearTimeout(timeout);
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [attempt]);

  useEffect(() => {
    setWishlist(loadWishlist());
    try {setRecent(cleanIds(JSON.parse(localStorage.getItem('zay-recent-v1')||'[]'),30));}catch{}
    try { const stored = localStorage.getItem('zay-currency'); if (CURRENCIES.includes(stored)) setCurrency(stored); } catch {}
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/exchange-rate', { signal: controller.signal }).then(response => response.ok ? response.json() : null).then(rate => {
      if (rate && Number.isFinite(rate.usdToCad) && rate.usdToCad > 0 && /^\d{4}-\d{2}-\d{2}$/.test(rate.date)) setExchangeRate(rate);
    }).catch(() => {});
    return () => controller.abort();
  }, []);

  // Stable identity, so memoized cards don't re-render when the parent does.
  const toggleWishlist = useCallback((id) => {
    record('save_toggle', { product: id });
    setWishlist(prev => {
      const next = prev.includes(id)
        ? prev.filter(n => n !== id)
        : [...prev, id].slice(-WISHLIST_MAX);
      saveWishlist(next);
      return next;
    });
  }, []);

  // Membership lookup per card was a linear scan of the whole wishlist.
  const wishlistSet = useMemo(() => new Set(wishlist), [wishlist]);

  const audienceItems = useMemo(() => items.filter(item => audience === 'everyone' || audienceFor(item) === 'everyone' || audienceFor(item) === audience), [items, audience]);
  const activeView = view || 'all';
  const searching = Boolean(deferredSearch.trim());
  const collectionBase = useMemo(() => activeView === 'all' ? collectionItems(audienceItems, collection, demand, currency, exchangeRate.usdToCad) : audienceItems, [audienceItems, collection, activeView, demand, currency, exchangeRate.usdToCad]);
  const base = useMemo(() => viewItems(collectionBase, activeView, wishlistSet, deferredSearch),
    [collectionBase, activeView, wishlistSet, deferredSearch]);
  const categories = useMemo(() => categoriesFor(audienceItems.filter(item => item.visibility !== 'hidden'), collectionOrder), [audienceItems, collectionOrder]);
  const categoryCanBeValidated = urlFiltersReady && !loading && !error;
  const categoryExists = categories.some(option => option.value === category);
  const effectiveCategory = !category || !categoryCanBeValidated || categoryExists ? category : '';
  useEffect(() => {
    if (categoryCanBeValidated && category !== effectiveCategory) {
      setCategory(effectiveCategory);
      updateFiltersInUrl(activeView, effectiveCategory, audience, collection);
    }
  }, [activeView, category, categoryCanBeValidated, effectiveCategory, updateFiltersInUrl, audience, collection]);
  const simpleSaved = activeView === 'saved';
  const fitView = activeView === 'fits';
  const filtered = useMemo(() => {
    const sheetOrder = new Map(items.map((item,index)=>[item.id,index]));
    const orderedBase = collection && sortBy === 'default' ? [...base].sort((a,b)=>sheetOrder.get(a.id)-sheetOrder.get(b.id)) : base;
    const list = filterAndSort(orderedBase, simpleSaved ? '' : effectiveCategory, sortBy === 'trending' ? 'default' : sortBy, currency, exchangeRate.usdToCad);
    return sortBy === 'trending' && !simpleSaved && !collection ? rankRecommended(list, demand) : list;
  }, [items, base, effectiveCategory, sortBy, simpleSaved, currency, exchangeRate.usdToCad, demand, collection]);
  const hasScopedTrends = demand.status === 'ready' && filtered.some(item => item.image && Number.isFinite(demand.scores[item.id]));
  // Scope pagination to the exact result array: a changed filter is capped in
  // the first render, not in an effect after an oversized grid has mounted.
  const visibleCount = page.list === filtered ? page.count : PAGE_SIZE;
  const visible = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
  const homeLoading=loading && activeView==='all' && !category && !collection && !search.trim();
  const showHome = !loading && !error && activeView === 'all' && !effectiveCategory && !collection && !search.trim() && sortBy === 'trending';
  const sections = useMemo(() => homeSections(audienceItems, demand, currency, exchangeRate.usdToCad), [audienceItems, demand, currency, exchangeRate.usdToCad]);
  const looks = useMemo(() => availableLooks(items, audience), [items, audience]);
  const requestedFit = Array.isArray(router.query.fit) ? router.query.fit[0] : router.query.fit;
  const selectedFit = looks.find(look => look.id === requestedFit) || looks[0];
  const fitLinkScrolled = useRef(false);
  useEffect(() => {
    if (fitView && !loading && requestedFit && !fitLinkScrolled.current && window.location.hash === '#shop-the-fit') {
      fitLinkScrolled.current = true;
      requestAnimationFrame(()=>document.getElementById('shop-the-fit')?.scrollIntoView({block:'start'}));
    }
  }, [fitView, loading, requestedFit]);
  const fitItems = useMemo(() => selectedFit?.pieces.map(piece=>piece.item) || [], [selectedFit]);
  const trackedItems = useMemo(() => fitView ? fitItems : showHome ? [...visible, ...sections.flatMap(section => section.items)] : visible, [fitView, showHome, visible, sections, fitItems]);
  const trackDemand = useDemandTracking(demand.collect, trackedItems);
  const onDemand = useCallback((id,event)=>{
    trackDemand(id,event);
    if(event==='click')setRecent(previous=>{
      const next=[id,...previous.filter(value=>value!==id)].slice(0,30);
      try{localStorage.setItem('zay-recent-v1',JSON.stringify(next));}catch{}
      return next;
    });
  },[trackDemand]);
  const openPreview=useCallback(item=>{
    setPreviewItem(item);
    setRecent(previous=>{const next=[item.id,...previous.filter(id=>id!==item.id)].slice(0,30);try{localStorage.setItem('zay-recent-v1',JSON.stringify(next));}catch{}return next;});
  },[]);
  function saveWholeLook(ids) {
    const result = saveLook(wishlist, ids, WISHLIST_MAX);
    if (result.status === 'saved') {
      setWishlist(result.ids);saveWishlist(result.ids);
      result.added.forEach(id=>onDemand(id,'save'));
      if(fitView && selectedFit)record('fit_save', {fit: selectedFit.id, pieces: result.added.length});
    }
    return result;
  }
  function selectFit(id) {
    router.push({pathname:router.pathname,query:{...router.query,fit:id}},undefined,{shallow:true,scroll:false});
  }
  const collectionTitle = collection === 'new' ? 'Just Added' : collection === 'budget' ? `Under $25 ${currency}` : collection === 'trending' ? 'Trending This Week' : '';
  const counts = useMemo(() => ({
    week: audienceItems.filter(item => item.visibility === 'weekly').length,
    all: audienceItems.filter(item => item.visibility !== 'hidden').length,
    bought: audienceItems.filter(item => item.visibility !== 'hidden' && item.personallyBought).length,
    saved: audienceItems.filter(item => item.visibility !== 'hidden' && wishlistSet.has(item.id)).length,
  }), [audienceItems, wishlistSet]);
  useEffect(() => {
    if (loading || error || !searching) return;
    const timer = setTimeout(() => {record(filtered.length ? 'search_results' : 'search_empty', { scope: `${activeView}:${effectiveCategory || 'all'}`, results: filtered.length });if(!filtered.length&&activeView!=='saved'&&activeView!=='fits')siteSignal({type:'search_empty',query:deferredSearch.trim()});}, 1200);
    return () => clearTimeout(timer);
  }, [deferredSearch, effectiveCategory, activeView, filtered.length, loading, error, searching]);
  function selectAudience(next) {
    if (next === audience) return;
    setAudience(next);
    setCategory('');
    try { localStorage.setItem('zay-audience', next); } catch {}
    updateFiltersInUrl(activeView, '', next, collection);
  }
  function selectCategory(next) {
    if (fitView) setView('all');
    setCollection('');
    setCategory(next);
    updateFiltersInUrl(fitView ? 'all' : activeView, next);
  }
  function selectView(next) {
    setCollection('');
    setView(next);
    setSearch('');
    setCategory('');
    updateFiltersInUrl(next, '');
  }

  return (
    <>
      <Head>
        <title>ZAY FINDS</title>
        <meta name="description" content="Clothing, accessories and everyday finds curated by Zay." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://si.geilicdn.com" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        {/* Tints the browser/OS chrome to match, so the page doesn't sit in a white frame */}
        {/* keys are required — next/head otherwise dedupes these two by name */}
        <meta key="tc-light" name="theme-color" content="#584943" media="(prefers-color-scheme: light)" />
        <meta key="tc-dark" name="theme-color" content="#14120F" media="(prefers-color-scheme: dark)" />

        {/* Social share preview (iMessage, Instagram, Discord, Facebook, etc.) */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="ZAY FINDS" />
        <meta property="og:title" content="ZAY FINDS" />
        <meta property="og:description" content="Clothing, accessories and everyday finds curated by Zay." />

        {/* Twitter / X */}
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="ZAY FINDS" />
        <meta name="twitter:description" content="Clothing, accessories and everyday finds curated by Zay." />
      </Head>

      <main style={{ minHeight: '100vh', background: 'var(--cream)' }}>
        <header className="site-header">
          <div className="header-inner">
            <div className="brand">
              <h1>ZAY FINDS</h1>
              <p>THE FINDS. ALL IN ONE PLACE.</p>
            </div>
            <div className="header-actions">
              <div className="audience-switch" role="group" aria-label="Shop for">
                {['everyone', 'men', 'women'].map(value => <button key={value} type="button" aria-pressed={audience === value} onClick={() => selectAudience(value)}>{value === 'everyone' ? 'Everyone' : value === 'men' ? 'Men' : 'Women'}</button>)}
              </div>
              <select className="currency-select control" aria-label="Currency" value={currency} onChange={event => { setCurrency(event.target.value); try { localStorage.setItem('zay-currency', event.target.value); } catch {} }}>
                {CURRENCIES.map(value => <option key={value}>{value}</option>)}
              </select>
              <SocialLinks record={record} />
            </div>
          </div>
        </header>

        <section className="intro compact-intro" aria-label="Welcome">
          <div><h2>{effectiveCategory ? categories.find(c => c.value === effectiveCategory)?.label : collectionTitle || (fitView ? 'Build A Fit.' : activeView === 'saved' ? 'Your saved finds.' : activeView === 'bought' ? 'Personally Bought.' : audience === 'men' ? 'Finds for Men.' : audience === 'women' ? 'Finds for Women.' : 'Good finds. Great taste.')}</h2><p className="intro-copy">{effectiveCategory ? 'Explore the collection. Find your next favorite.' : 'Clothing, accessories & everyday finds curated by Zay.'}</p></div>
        </section>
        <div className="desktop-buying-help"><BuyingGuide record={record} /></div>
        <div className="shopping-tools">
          <div className="tools-inner">
            {!fitView && <div className="search-wrap" role="search">
              <input type="search" aria-label={simpleSaved ? 'Search saved finds' : 'Search finds'} placeholder={simpleSaved ? 'Search saved finds…' : 'Search this collection…'} value={search} onChange={event => setSearch(event.target.value)} />
              {search && <button className="clear-search" type="button" onClick={() => setSearch('')} aria-label="Clear search">Clear ×</button>}
            </div>}
            {!simpleSaved && !fitView && <MobileFilters categories={categories} category={effectiveCategory} sort={sortBy} recommendedLabel={collection === 'new' ? 'Newest first' : 'Recommended'} onApply={(nextCategory,nextSort)=>{if(nextCategory!==effectiveCategory)selectCategory(nextCategory);setSortBy(nextSort);}}/>}
            <nav className="shopping-tabs" aria-label="Shopping views">
              {[['all', 'All Finds'], ['bought', 'Personally Bought'], ['saved', 'Saved'], ['fits', 'Build A Fit']].map(([value, label]) =>
                <button type="button" key={value} aria-pressed={activeView === value} onClick={() => selectView(value)}>
                  {label} {value!=='fits' && <span>({counts[value].toLocaleString()})</span>}
                </button>
              )}
            </nav>
            {!simpleSaved && !fitView && <div className="content-controls">
              <CategoryFilter categories={categories} value={effectiveCategory} onChange={selectCategory} />
              <label className="sort-control control"><span className="sort-control-title">Sort</span>
                <select aria-label="Sort products" value={sortBy} onChange={event => setSortBy(event.target.value)}>
                  <option value="trending">{collection === 'new' ? 'Newest first' : 'Recommended'}</option>
                  <option value="default">Sheet order</option>
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                  <option value="name">Name: A to Z</option>
                </select>
              </label>
            </div>}
            {!simpleSaved && <nav className="mobile-browse-categories" aria-label="Browse categories"><button type="button" aria-pressed={!effectiveCategory&&!fitView} onClick={()=>selectCategory('')}>All categories</button>{categories.map(c=><button type="button" key={c.value} aria-pressed={effectiveCategory===c.value&&!fitView} onClick={()=>selectCategory(c.value)}>{c.label}</button>)}</nav>}
          </div>
        </div>

        <MobileBuyingHelp record={record}/>
        {homeLoading && <HomeSkeleton/>}
        {fitView && !loading && !error && <ShopTheFit key={audience} looks={looks} selectedId={selectedFit?.id} onSelect={selectFit} wishlistSet={wishlistSet} onSave={saveWholeLook} onViewSaved={()=>selectView('saved')} currency={currency} rate={exchangeRate.usdToCad} onDemand={onDemand} audience={audience} onPreview={openPreview}/>}
        {showHome && <HomeCollections sections={sections} audience={audience} renderCard={(item,index,sectionIndex)=><ItemCard item={item} wishlisted={wishlistSet.has(item.id)} onWishlist={toggleWishlist} currency={currency} usdToCad={exchangeRate.usdToCad} onDemand={onDemand} onPreview={openPreview} priority={sectionIndex===0 && index<2}/>}/>}
        {fitView && loading && <p className="fit-route-message" role="status">Loading looks…</p>}
        {fitView && error && <div className="fit-route-message" role="alert"><p>{error}</p><button className="control" onClick={()=>setAttempt(value=>value+1)}>Retry</button></div>}
        {fitView && !loading && !error && !looks.length && <p className="fit-route-message">More looks are on the way.</p>}
        {simpleSaved && !loading && !error && <HaulBuilder items={items} wishlist={wishlist} onWishlist={toggleWishlist} onSave={saveWholeLook} currency={currency} rate={exchangeRate.usdToCad} audience={audience} search={deferredSearch} recent={recent} onDemand={onDemand} onBrowse={()=>selectView('all')} onPreview={openPreview}/>}
        {!homeLoading && !fitView && (!simpleSaved || loading || error) && <section id="catalogue" className="catalogue" aria-label={searching ? 'Search results' : activeView === 'saved' ? 'Saved finds' : activeView === 'week' ? 'This Week' : 'All Finds'} aria-busy={loading || search !== deferredSearch}>
          {showHome && <h2 className="full-catalogue-title">All Finds</h2>}
          {collectionTitle && <div className="collection-context"><p>{collectionTitle}{collection === 'budget' ? ' · Item prices before shipping' : ''}</p><button type="button" className="control" onClick={()=>selectView('all')}>Back to all finds</button></div>}
          {!loading && !error && <div className="catalogue-summary"><p>{filtered.length.toLocaleString()} finds{audience !== 'everyone' ? ' · ' + (audience === 'men' ? 'Men' : 'Women') : ''}{effectiveCategory ? ' · ' + categories.find(c => c.value === effectiveCategory)?.label : ''}</p><p>{currency === 'CAD' ? `CAD estimates · Rate ${exchangeRate.date} · Shipping extra` : 'USD item prices · Shipping extra · Confirm at checkout'}</p></div>}
          {!loading && !error && !simpleSaved && sortBy === 'trending' && (!collection || collection === 'trending') && hasScopedTrends && <p className="trending-note">Popular with shoppers, with room for new discoveries.</p>}
          {searching && <h2 className="search-heading">Search results for “{deferredSearch.trim()}”</h2>}
          {loading ? <div className="product-grid" role="status" aria-label="Loading catalogue">
            {Array.from({ length: 8 }, (_, index) => <div className="skeleton-card" key={index} aria-hidden="true"><div className="skeleton-image" /><div className="skeleton-copy"><div /><div /><div /></div></div>)}
          </div> : error ? <div className="catalogue-message" role="alert">
            <h2>Catalogue unavailable</h2><p>{error}</p>
            <button className="control" type="button" onClick={() => setAttempt(value => value + 1)}>Retry</button>
          </div> : filtered.length === 0 ? <div className="catalogue-message" role="status">
            <p className="empty-symbol">✦</p>
            <h2>{searching ? 'No matching finds' : simpleSaved ? 'Save your favorite finds' : 'No finds here yet'}</h2>
            <p>{simpleSaved ? audience === 'everyone' ? 'Tap a heart on any product to keep it here.' : 'No saved finds in this selection. Choose Everyone to see all your saved items.' : 'Try another category or browse all finds.'}</p>
            <button className="control" type="button" onClick={() => {
              setSearch('');
              if (searching) return;
              if (simpleSaved && audience !== 'everyone') selectAudience('everyone');
              else selectView('all');
            }}>{searching ? 'Clear search' : simpleSaved && audience !== 'everyone' ? 'Show Everyone' : 'Browse All Finds'}</button>
          </div> : <div className="product-grid">
            {visible.map((item, index) => <ItemCard key={item.id} item={item} wishlisted={wishlistSet.has(item.id)} onWishlist={toggleWishlist} currency={currency} usdToCad={exchangeRate.usdToCad} onDemand={onDemand} onPreview={openPreview} priority={!showHome && index < 4} />)}
          </div>}
          {!loading && !error && filtered.length > visibleCount && <div className="load-more">
            <button className="control" type="button" onClick={() => setPage({ list: filtered, count: visibleCount + PAGE_SIZE })}>Load more</button>
          </div>}
        </section>}
        {previewItem&&<QuickView item={previewItem} items={items} currency={currency} rate={exchangeRate.usdToCad} audience={audience} wishlist={wishlistSet} onWishlist={toggleWishlist} onSelect={openPreview} onClose={()=>setPreviewItem(null)} onDemand={onDemand}/>}
        <footer className="site-footer"><strong>ZAY FINDS</strong><a href="https://www.kakobuy.com/register?affcode=ZAYFINDS" target="_blank" rel="noopener noreferrer" onClick={() => record('signup_click', { placement: 'footer' })}>Get your $400 Coupon Bundle</a><p>Zay Finds helps you discover products. Orders, payments and shipping are handled by the linked seller or shopping agent. Prices may change; shipping and other checkout charges are extra. Some links are affiliate links.</p></footer>
      </main>
    </>
  );
}
