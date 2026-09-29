import { useState, useEffect, useMemo, useCallback, useDeferredValue, memo } from 'react';
import Head from 'next/head';
import initialExchangeRate from '../data/exchange-rate.json';
import { track } from '@vercel/analytics';
import BuyingGuide from '../components/BuyingGuide';
import { useRouter } from 'next/router';
import SocialLinks from '../components/SocialLinks';
import CategoryFilter from '../components/CategoryFilter';
import { viewItems, categoriesFor, filterAndSort, catalogueFiltersFromQuery, priceAmount } from '../lib/catalogue';

// Cards are never wider than ~220px, but the sheet links full-size originals
// (often 1440x1920). The Weidian CDN resizes on request — asking for 400px wide
// cuts roughly 86% of the bytes with no visible difference at 2x density.
const THUMB_WIDTH = 400;
function thumb(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'si.geilicdn.com') parsed.searchParams.set('w', String(THUMB_WIDTH));
    return parsed.toString();
  } catch { return url; }
}

// How many cards to mount at once. Womens alone is ~1,900 rows, which locks up
// the main thread if rendered in a single commit.
const PAGE_SIZE = 60;

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

const ItemCard = memo(function ItemCard({ item, wishlisted, onWishlist, currency, priority, usdToCad }) {
  const [imgError, setImgError] = useState(false);

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
      {item.link && <a className="card-link" href={item.link} target="_blank" rel="noopener noreferrer" aria-label={`Shop ${item.name}`} onClick={() => record('product_click', { product: item.id, category: item.category })} />}
      {/* Image */}
      <div style={{ position: 'relative', width: '100%', paddingBottom: '100%', background: 'var(--cream)', overflow: 'hidden' }}>
        {item.image && !imgError ? (
          <img
            className="card-img"
            src={thumb(item.image)}
            alt={item.name}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            decoding="async"
            onError={() => setImgError(true)}
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
            <span className="photo-placeholder"><span>Z.</span><small>View photos at seller ↗</small></span>
          </div>
        )}
        {/* Wishlist button */}
        <button
          onClick={event => { event.stopPropagation(); onWishlist(item.id); }}
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
          {item.personallyBought && <span className="personally-bought"><span aria-hidden="true">✓</span> Personally bought</span>}
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
        <span className="shop-label">{item.link?.includes('kakobuy.com') ? 'View on Kakobuy' : 'View at seller'} ↗</span>
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
  const [currency, setCurrency] = useState('USD');
  const [exchangeRate, setExchangeRate] = useState(initialExchangeRate);
  const [wishlist, setWishlist] = useState([]);
  const [view, setView] = useState(null);
  const [sortBy, setSortBy] = useState('default');
  const [page, setPage] = useState({ list: null, count: PAGE_SIZE });
  const [urlFiltersReady, setUrlFiltersReady] = useState(false);

  // TODO: Give categories stable IDs/slugs so shared links survive future label changes.
  // TODO: Consider adding a Copy link button for the currently selected view/category.
  useEffect(() => {
    if (!router.isReady) return;
    const filters = catalogueFiltersFromQuery(router.query);
    setView(filters.view || 'all');
    setCategory(filters.category);
    setUrlFiltersReady(true);
  }, [router.isReady, router.query.view, router.query.category]);

  const updateFiltersInUrl = useCallback((nextView, nextCategory) => {
    if (!router.isReady) return;
    const query = { ...router.query };
    if (nextView) query.view = nextView;
    else delete query.view;
    if (nextCategory) query.category = nextCategory;
    else delete query.category;
    void router.push({ pathname: router.pathname, query }, undefined, { shallow: true, scroll: false });
  }, [router]);

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
        const response = await fetch('/api/catalogue?compact=1', { signal: controller.signal, cache: 'default' });
        if (!response.ok) throw new Error('Catalogue request failed');
        const { items: rows, collections } = await response.json();
        if (!active) return;
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

  const activeView = view || 'all';
  const searching = Boolean(deferredSearch.trim());
  const base = useMemo(() => viewItems(items, activeView, wishlistSet, deferredSearch),
    [items, activeView, wishlistSet, deferredSearch]);
  const categories = useMemo(() => categoriesFor(items.filter(item => item.visibility !== 'hidden'), collectionOrder), [items, collectionOrder]);
  const categoryCanBeValidated = urlFiltersReady && !loading && !error;
  const categoryExists = categories.some(option => option.value === category);
  const effectiveCategory = !category || !categoryCanBeValidated || categoryExists ? category : '';
  useEffect(() => {
    if (categoryCanBeValidated && category !== effectiveCategory) {
      setCategory(effectiveCategory);
      updateFiltersInUrl(activeView, effectiveCategory);
    }
  }, [activeView, category, categoryCanBeValidated, effectiveCategory, updateFiltersInUrl]);
  const simpleSaved = activeView === 'saved';
  const filtered = useMemo(() => filterAndSort(base, simpleSaved ? '' : effectiveCategory, sortBy === 'default' && !effectiveCategory && !simpleSaved ? 'featured' : sortBy, currency, exchangeRate.usdToCad),
    [base, effectiveCategory, sortBy, simpleSaved, currency, exchangeRate.usdToCad]);
  // Scope pagination to the exact result array: a changed filter is capped in
  // the first render, not in an effect after an oversized grid has mounted.
  const visibleCount = page.list === filtered ? page.count : PAGE_SIZE;
  const visible = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
  const counts = useMemo(() => ({
    week: items.filter(item => item.visibility === 'weekly').length,
    all: items.filter(item => item.visibility !== 'hidden').length,
    bought: items.filter(item => item.visibility !== 'hidden' && item.personallyBought).length,
    saved: items.filter(item => item.visibility !== 'hidden' && wishlistSet.has(item.id)).length,
  }), [items, wishlistSet]);
  useEffect(() => {
    if (loading || error || !searching) return;
    const timer = setTimeout(() => record(filtered.length ? 'search_results' : 'search_empty', { scope: `${activeView}:${effectiveCategory || 'all'}`, results: filtered.length }), 800);
    return () => clearTimeout(timer);
  }, [deferredSearch, effectiveCategory, activeView, filtered.length, loading, error, searching]);
  function selectCategory(next) {
    setCategory(next);
    updateFiltersInUrl(activeView, next);
  }
  function selectView(next) {
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
              <select className="currency-select control" aria-label="Currency" value={currency} onChange={event => { setCurrency(event.target.value); try { localStorage.setItem('zay-currency', event.target.value); } catch {} }}>
                {CURRENCIES.map(value => <option key={value}>{value}</option>)}
              </select>
              <SocialLinks record={record} />
            </div>
          </div>
        </header>

        <section className="intro compact-intro" aria-label="Welcome">
          <div><h2>{effectiveCategory ? categories.find(c => c.value === effectiveCategory)?.label : activeView === 'saved' ? 'Your saved finds.' : activeView === 'bought' ? 'Personally bought.' : 'Good finds. Great taste.'}</h2><p className="intro-copy">{effectiveCategory ? 'Explore the collection. Find your next favorite.' : 'Clothing, accessories & everyday finds curated by Zay.'}</p></div>
        </section>
        <BuyingGuide record={record} />
        <div className="shopping-tools">
          <div className="tools-inner">
            <div className="search-wrap" role="search">
              <input type="search" aria-label={simpleSaved ? 'Search saved finds' : 'Search finds'} placeholder={simpleSaved ? 'Search saved finds…' : 'Search this collection…'} value={search} onChange={event => setSearch(event.target.value)} />
              {search && <button className="clear-search" type="button" onClick={() => setSearch('')} aria-label="Clear search">Clear ×</button>}
            </div>
            <nav className="shopping-tabs" aria-label="Shopping views">
              {[['all', 'All Finds'], ['bought', 'Personally bought'], ['saved', 'Saved']].map(([value, label]) =>
                <button type="button" key={value} aria-pressed={activeView === value} onClick={() => selectView(value)}>
                  {label} <span>({counts[value].toLocaleString()})</span>
                </button>
              )}
            </nav>
            {!simpleSaved && <div className="content-controls">
              <CategoryFilter categories={categories} value={effectiveCategory} onChange={selectCategory} />
              <label className="sort-control control">Sort
                <select aria-label="Sort products" value={sortBy} onChange={event => setSortBy(event.target.value)}>
                  <option value="default">{effectiveCategory ? 'Sheet order' : 'Featured first'}</option>
                  <option value="price-asc">Price: Low → High</option>
                  <option value="price-desc">Price: High → Low</option>
                  <option value="name">Name: A → Z</option>
                </select>
              </label>
            </div>}
          </div>
        </div>

        <section className="catalogue" aria-label={searching ? 'Search results' : activeView === 'saved' ? 'Saved finds' : activeView === 'week' ? 'This Week' : 'All Finds'} aria-busy={loading || search !== deferredSearch}>
          {!loading && !error && <div className="catalogue-summary"><p>{filtered.length.toLocaleString()} finds{effectiveCategory ? ' · ' + categories.find(c => c.value === effectiveCategory)?.label : ''}</p><p>{currency === 'CAD' ? `CAD estimates · Rate ${exchangeRate.date} · Shipping extra` : 'USD item prices · Shipping extra · Confirm at checkout'}</p></div>}
          {searching && <h2 className="search-heading">Search results for “{deferredSearch.trim()}”</h2>}
          {loading ? <div className="product-grid" role="status" aria-label="Loading catalogue">
            {Array.from({ length: 8 }, (_, index) => <div className="skeleton-card" key={index} aria-hidden="true"><div className="skeleton-image" /><div className="skeleton-copy"><div /><div /><div /></div></div>)}
          </div> : error ? <div className="catalogue-message" role="alert">
            <h2>Catalogue unavailable</h2><p>{error}</p>
            <button className="control" type="button" onClick={() => setAttempt(value => value + 1)}>Retry</button>
          </div> : filtered.length === 0 ? <div className="catalogue-message" role="status">
            <p className="empty-symbol">✦</p>
            <h2>{searching ? 'No matching finds' : simpleSaved ? 'Save your favorite finds' : 'No finds here yet'}</h2>
            <p>{simpleSaved ? 'Tap a heart on any product to keep it here.' : 'Try another category or browse all finds.'}</p>
            <button className="control" type="button" onClick={() => {
              setSearch('');
              if (searching) return;
              else selectView('all');
            }}>{searching ? 'Clear search' : 'Browse All Finds'}</button>
          </div> : <div className="product-grid">
            {visible.map((item, index) => <ItemCard key={item.id} item={item} wishlisted={wishlistSet.has(item.id)} onWishlist={toggleWishlist} currency={currency} usdToCad={exchangeRate.usdToCad} priority={index < 4} />)}
          </div>}
          {!loading && !error && filtered.length > visibleCount && <div className="load-more">
            <button className="control" type="button" onClick={() => setPage({ list: filtered, count: visibleCount + PAGE_SIZE })}>Load more</button>
          </div>}
        </section>
        <footer className="site-footer"><strong>ZAY FINDS</strong><a href="https://www.kakobuy.com/register?affcode=ZAYFINDS" target="_blank" rel="noopener noreferrer" onClick={() => record('signup_click', { placement: 'footer' })}>Get your $400 coupon bundle ↗</a><p>Zay Finds helps you discover products. Orders, payments and shipping are handled by the linked seller or shopping agent. Prices may change; shipping and other checkout charges are extra. Some links are affiliate links.</p></footer>
      </main>
    </>
  );
}
