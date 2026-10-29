import Head from 'next/head';
import Link from 'next/link';

const steps = [
  ['Find your piece', 'Browse Zay Finds and tap “View on Kakobuy” on a product you like. This website replaces the spreadsheet step in the video.'],
  ['Choose your options', 'Create your Kakobuy account, then check the size chart, color, quantity and current price before ordering. The current signup code is ZAYFINDS.'],
  ['Order to the warehouse', 'Pay for your items and any domestic shipping. Kakobuy buys them from the seller and receives them at its warehouse in China.'],
  ['Check your items, then ship', 'Review the warehouse photos. When you’re ready, choose the items to send, select a shipping method and pay international shipping separately.'],
];

export default function HowToBuy() {
  return <>
    <Head>
      <title>How to Buy | ZAY FINDS</title>
      <meta name="description" content="Watch Zay’s buying tutorial and follow the steps from finding your first piece to shipping your order." />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta property="og:title" content="How to Buy | ZAY FINDS" />
      <meta property="og:description" content="Your first order, step by step. Watch Zay’s buying tutorial." />
      <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    </Head>
    <main className="tutorial-page">
      <header className="tutorial-nav"><Link href="/" className="tutorial-brand">ZAY FINDS</Link><Link href="/">← Back to the finds</Link></header>
      <section className="tutorial-intro"><p className="tutorial-eyebrow">THE BUYING GUIDE</p><h1>Your first order.<br />Step by step.</h1><p>Watch the tutorial, then use the checklist below to get started.</p></section>
      <div className="tutorial-layout">
        <section className="tutorial-video" aria-label="Buying tutorial video">
          <video controls playsInline preload="none" aria-label="Zay’s full buying tutorial">
            <source src="/videos/buying-tutorial.mp4" type="video/mp4" />
            Your browser does not support this video. <a href="/videos/buying-tutorial.mp4">Open the tutorial video</a>.
          </video>
          <p>Pause and replay whenever you need. <a href="/videos/buying-tutorial.mp4">Open video full size ↗</a></p>
        </section>
        <section className="tutorial-checklist" aria-labelledby="steps-title"><h2 id="steps-title">From finding it to shipping it.</h2><ol>{steps.map(([title, description]) => <li key={title}><h3>{title}</h3><p>{description}</p></li>)}</ol>
          <div className="tutorial-actions"><a href="https://www.kakobuy.com/register?affcode=ZAYFINDS" target="_blank" rel="noopener noreferrer">Create a Kakobuy account ↗</a><Link href="/">Browse the finds →</Link></div>
          <p className="tutorial-note">Item prices and international shipping are separate. Check current costs, shipping options and any taxes for your destination before paying. Some finds link directly to other sellers and use their checkout process.</p>
        </section>
      </div>
    </main>
    <style jsx>{`
      .tutorial-page{max-width:1120px;margin:auto;padding:24px 24px 64px}.tutorial-nav{display:flex;justify-content:space-between;align-items:center;gap:20px;border-bottom:1px solid var(--border);padding-bottom:24px}.tutorial-nav :global(a){color:var(--ink);text-decoration:none;font-size:14px}.tutorial-nav :global(.tutorial-brand){font-weight:800;letter-spacing:3px;font-size:20px}.tutorial-intro{padding:48px 0 36px}.tutorial-eyebrow{font-size:12px;letter-spacing:3px;margin-bottom:16px}.tutorial-intro h1{font-size:clamp(40px,6vw,68px);line-height:1.08;margin-bottom:20px}.tutorial-intro>p:last-child{line-height:1.6}.tutorial-layout{display:grid;grid-template-columns:minmax(0,420px) minmax(0,1fr);gap:56px;align-items:start}.tutorial-video video{display:block;width:100%;aspect-ratio:9/16;background:#111;border-radius:16px;object-fit:contain}.tutorial-video p{font-size:13px;line-height:1.8;margin-top:12px}.tutorial-video a{color:inherit;text-decoration:underline}.tutorial-checklist h2{font-size:28px;line-height:1.25;margin-bottom:28px}.tutorial-checklist ol{list-style:none;counter-reset:step}.tutorial-checklist li{position:relative;padding:0 0 28px 48px;counter-increment:step}.tutorial-checklist li:before{content:counter(step);position:absolute;left:0;top:0;width:30px;height:30px;display:grid;place-items:center;border:1px solid var(--border);border-radius:50%;font-size:13px}.tutorial-checklist h3{font-size:21px;margin-bottom:8px}.tutorial-checklist li p{font-size:15px;line-height:1.7}.tutorial-actions{display:flex;flex-direction:column;gap:12px}.tutorial-actions :global(a){display:block;padding:15px 18px;text-align:center;border:1px solid var(--ink);border-radius:8px;color:var(--ink);font-weight:600;text-decoration:none}.tutorial-actions a:first-child{background:var(--ink);color:var(--on-ink)}.tutorial-note{font-size:12px;line-height:1.8;margin-top:20px} @media(max-width:700px){.tutorial-page{padding:20px 18px 48px}.tutorial-intro{padding:36px 0 28px}.tutorial-layout{grid-template-columns:1fr;gap:36px}.tutorial-video{width:100%;max-width:420px;margin:auto}.tutorial-nav :global(.tutorial-brand){font-size:16px;letter-spacing:2px}}
    `}</style>
  </>;
}
