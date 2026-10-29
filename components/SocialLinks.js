// Keep the buying tutorial accessible from the main header.
export default function SocialLinks({ record }) {
  return <nav className="social-links" aria-label="Zay links">
    <a className="tutorial-header-link" href="/how-to-buy" aria-label="Watch Zay's buying tutorial" title="Buying tutorial" onClick={() => record?.('tutorial_click', { placement: 'header' })}>
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M8 5v14l12-7z"/></svg><span>How to Buy</span>
    </a>
  </nav>;
}
