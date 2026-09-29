export default function BuyingGuide({ record }) {
  return <div className="buying-help">
    <div className="quick-links">
      <a className="signup-link" href="https://www.kakobuy.com/register?affcode=ZAYFINDS" target="_blank" rel="noopener noreferrer" onClick={() => record('signup_click', { placement: 'top' })}>$400 coupon bundle ↗</a>
      <a href="https://vt.tiktok.com/ZSx8afry8/" target="_blank" rel="noopener noreferrer" onClick={() => record('tutorial_click', {})}>Watch tutorial ↗</a>
    </div>
    <details className="buying-guide" onToggle={event => { if (event.currentTarget.open) record('buying_guide_open', {}); }}>
      <summary>New here? How buying works <span aria-hidden="true">＋</span></summary>
      <ol>
        <li><strong>Find your piece.</strong> Browse a category here, then tap “View on Kakobuy.” The website replaces the spreadsheet step in my video.</li>
        <li><strong>Sign up & choose your options.</strong> Use the signup link above, then check the size chart, color, quantity and current price on Kakobuy. The current signup code is ZAYFINDS.</li>
        <li><strong>Order to the warehouse.</strong> Pay for the items and applicable domestic shipping. Kakobuy buys them from the seller and receives them in China.</li>
        <li><strong>Check, then ship.</strong> Review the warehouse photos before arranging delivery. Select your items and shipping method, then pay international shipping separately.</li>
      </ol>
      <p>The signup bundle contains multiple coupons with a combined value of $400. Check coupon eligibility, minimum spend and expiry in your Kakobuy account. Final prices, shipping options and any taxes depend on your order and destination.</p>
      <p>A few items link directly to other sellers; follow their checkout process.</p>
    </details>
  </div>;
}
