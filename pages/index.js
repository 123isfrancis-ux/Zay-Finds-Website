import { useState, useEffect, useMemo, useCallback, useDeferredValue, memo } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import SocialLinks from '../components/SocialLinks';
import CategoryFilter from '../components/CategoryFilter';
import { viewItems, categoriesFor, filterAndSort, catalogueFiltersFromQuery } from '../lib/catalogue';

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

const ItemCard = memo(function ItemCard({ item, wishlisted, onWishlist, currency, priority }) {
  const [imgError, setImgError] = useState(false);

  const amount = item.prices?.[currency];
  const displayPrice = Number.isFinite(amount)
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
    : 'See item price';
  const subPrice = currency !== 'CNY' && Number.isFinite(item.prices?.CNY)
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'CNY' }).format(item.prices.CNY) + ' CNY'
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
      {item.link && <a className="card-link" href={item.link} target="_blank" rel="noopener noreferrer" aria-label={`Shop ${item.name}`} />}
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
          <Badge cat={item.category} />
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
    if (filters.view) setView(filters.view);
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
    void router.replace({ pathname: router.pathname, query }, undefined, { shallow: true, scroll: false });
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
        const response = await fetch('/api/catalogue', { signal: controller.signal, cache: 'no-store' });
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
  }, []);

  // Stable identity, so memoized cards don't re-render when the parent does.
  const toggleWishlist = useCallback((id) => {
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
  const categories = useMemo(() => categoriesFor(base, collectionOrder), [base, collectionOrder]);
  const categoryCanBeValidated = urlFiltersReady && !loading && !error;
  const categoryExists = categories.some(option => option.value === category);
  const effectiveCategory = !category || !categoryCanBeValidated || categoryExists ? category : '';
  useEffect(() => {
    if (categoryCanBeValidated && category !== effectiveCategory) {
      setCategory(effectiveCategory);
      updateFiltersInUrl(activeView, effectiveCategory);
    }
  }, [activeView, category, categoryCanBeValidated, effectiveCategory, updateFiltersInUrl]);
  const simpleSaved = activeView === 'saved' && !searching;
  const filtered = useMemo(() => filterAndSort(base, simpleSaved ? '' : effectiveCategory, simpleSaved ? 'default' : sortBy),
    [base, effectiveCategory, sortBy, simpleSaved]);
  // Scope pagination to the exact result array: a changed filter is capped in
  // the first render, not in an effect after an oversized grid has mounted.
  const visibleCount = page.list === filtered ? page.count : PAGE_SIZE;
  const visible = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
  const counts = useMemo(() => ({
    week: items.filter(item => item.visibility === 'weekly').length,
    all: items.filter(item => item.visibility === 'catalog').length,
    saved: items.filter(item => item.visibility !== 'hidden' && wishlistSet.has(item.id)).length,
  }), [items, wishlistSet]);
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
              <select className="currency-select control" aria-label="Currency" value={currency} onChange={event => setCurrency(event.target.value)}>
                {['USD', 'CNY', 'EUR', 'GBP'].map(value => <option key={value}>{value}</option>)}
              </select>
              <SocialLinks />
            </div>
          </div>
        </header>

        <section className="intro" aria-label="Welcome">
          <div><p className="eyebrow">THE ZAY COLLECTION</p><h2>Good finds.<br /><em>Great taste.</em></h2><p className="intro-copy">Your next favorite piece is in here. Explore clothing, accessories, room decor, and more.</p></div>
          <div className="intro-aside"><span className="intro-mark" aria-hidden="true">Z.</span><a href="https://docs.google.com/spreadsheets/d/1ISOjOe2mWaPv1ko9OfpEc40M1VwHvYtOebb86HrImQY/edit" target="_blank" rel="noopener noreferrer">Open the original spreadsheet ↗</a></div>
        </section>
        <nav className="quick-links" aria-label="Buying help and signup">
          <a href="https://vt.tiktok.com/ZSx8afry8/" target="_blank" rel="noopener noreferrer"><span aria-hidden="true">▷</span> Watch buying tutorial <span aria-hidden="true">↗</span></a>
          <a className="signup-link" href="https://www.kakobuy.com/register?affcode=ecdru" target="_blank" rel="noopener noreferrer">Sign up for $400 <span aria-hidden="true">↗</span></a>
        </nav>
        <div className="shopping-tools">
          <div className="tools-inner">
            <div className="search-wrap" role="search">
              <input type="search" aria-label="Search all finds" placeholder="Search all finds…" value={search} onChange={event => setSearch(event.target.value)} />
              {search && <button className="clear-search" type="button" onClick={() => setSearch('')} aria-label="Clear search">Clear ×</button>}
            </div>
            <nav className="shopping-tabs" aria-label="Shopping views">
              {[['all', 'All Finds'], ['saved', 'Saved']].map(([value, label]) =>
                <button type="button" key={value} aria-pressed={!searching && activeView === value} onClick={() => selectView(value)}>
                  {label} <span>({counts[value].toLocaleString()})</span>
                </button>
              )}
            </nav>
            {!simpleSaved && <div className="content-controls">
              <CategoryFilter categories={categories} value={effectiveCategory} onChange={selectCategory} />
              <label className="sort-control control">Sort
                <select aria-label="Sort products" value={sortBy} onChange={event => setSortBy(event.target.value)}>
                  <option value="default">Sheet order</option>
                  <option value="price-asc">Price: Low → High</option>
                  <option value="price-desc">Price: High → Low</option>
                  <option value="name">Name: A → Z</option>
                </select>
              </label>
            </div>}
          </div>
        </div>

        <section className="catalogue" aria-label={searching ? 'Search results' : activeView === 'saved' ? 'Saved finds' : activeView === 'week' ? 'This Week' : 'All Finds'} aria-busy={loading || search !== deferredSearch}>
          {!loading && !error && <div className="catalogue-summary"><p>{filtered.length.toLocaleString()} finds{effectiveCategory ? ' · ' + categories.find(c => c.value === effectiveCategory)?.label : ''}</p><p>Prices from the sheet · Confirm at seller</p></div>}
          {searching && <h2 className="search-heading">Search results for “{deferredSearch.trim()}”</h2>}
          {loading ? <div className="product-grid" role="status" aria-label="Loading catalogue">
            {Array.from({ length: 8 }, (_, index) => <div className="skeleton-card" key={index} aria-hidden="true"><div className="skeleton-image" /><div className="skeleton-copy"><div /><div /><div /></div></div>)}
          </div> : error ? <div className="catalogue-message" role="alert">
            <h2>Catalogue unavailable</h2><p>{error}</p>
            <button className="control" type="button" onClick={() => setAttempt(value => value + 1)}>Retry</button>
          </div> : filtered.length === 0 ? <div className="catalogue-message" role="status">
            <p className="empty-symbol">✦</p>
            <h2>{simpleSaved ? 'Save your favorite finds' : searching ? 'No matching finds' : 'No finds here yet'}</h2>
            <p>{simpleSaved ? 'Tap a heart on any product to keep it here.' : 'Try another category or browse all finds.'}</p>
            <button className="control" type="button" onClick={() => {
              setSearch('');
              if (searching) selectCategory('');
              else selectView('all');
            }}>{searching ? 'Clear search and filters' : 'Browse All Finds'}</button>
          </div> : <div className="product-grid">
            {visible.map((item, index) => <ItemCard key={item.id} item={item} wishlisted={wishlistSet.has(item.id)} onWishlist={toggleWishlist} currency={currency} priority={index < 4} />)}
          </div>}
          {!loading && !error && filtered.length > visibleCount && <div className="load-more">
            <button className="control" type="button" onClick={() => setPage({ list: filtered, count: visibleCount + PAGE_SIZE })}>Load more</button>
          </div>}
        </section>
        <footer className="site-footer"><strong>ZAY FINDS</strong><a href="https://www.kakobuy.com/register?affcode=ecdru" target="_blank" rel="noopener noreferrer">Create a Kakobuy account ↗</a></footer>
      </main>
    </>
  );
}
