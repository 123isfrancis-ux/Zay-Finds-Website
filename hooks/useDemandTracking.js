import { useCallback, useEffect, useRef } from 'react';
import { createCollector } from '../lib/demand-client';
export default function useDemandTracking(enabled, visibleItems) {
  const collector = useRef(null);
  useEffect(() => {
    if (!enabled || navigator.doNotTrack === '1' || navigator.globalPrivacyControl || !window.crypto?.randomUUID) return;
    const send = body => fetch('/api/trending', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify(body), keepalive:true, signal:AbortSignal.timeout(5000),
    });
    let storage;
    try { storage = window.localStorage; } catch { storage = { getItem:()=>null,setItem:()=>{} }; }
    const current = createCollector({storage, randomUUID:()=>window.crypto.randomUUID(), send});
    collector.current = current;
    const flush = () => current.flush();
    const timer = setInterval(flush, 3000);
    window.addEventListener('pagehide',flush);
    document.addEventListener('visibilitychange',flush);
    return () => { clearInterval(timer); window.removeEventListener('pagehide',flush); document.removeEventListener('visibilitychange',flush); flush(); collector.current = null; };
  }, [enabled]);
  useEffect(() => {
    if (!enabled || !collector.current || !window.IntersectionObserver) return;
    const timers = new Map();
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const element = entry.target;
        clearTimeout(timers.get(element)); timers.delete(element);
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5 && document.visibilityState === 'visible') {
          timers.set(element, setTimeout(() => {
            timers.delete(element);
            if (document.visibilityState === 'visible') collector.current?.add(element.dataset.productId, 'view');
          }, 1000));
        }
      }
    }, {threshold:0.5});
    const cards = Array.from(document.querySelectorAll('.card[data-product-id], .fit-photo[data-product-id]'));
    const observe = () => {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear(); observer.disconnect();
      if (document.visibilityState === 'visible') cards.forEach(card => observer.observe(card));
    };
    observe(); document.addEventListener('visibilitychange',observe);
    return () => { observer.disconnect(); for (const timer of timers.values()) clearTimeout(timer); document.removeEventListener('visibilitychange',observe); };
  }, [enabled, visibleItems]);
  return useCallback((id, type) => {
    collector.current?.add(id,type);
    // Clicks and saves leave immediately; shopping never waits for analytics.
    collector.current?.flush();
  }, []);
}
