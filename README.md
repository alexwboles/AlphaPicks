# AlphaPicks

Weekly AI-generated stock picks, delivered every Sunday.

- Backend: Cloudflare Workers + D1
- Billing: Stripe weekly subscription
- Data: News + basic market data
- Output: Top 5 tickers per week, gated behind subscription

## Setup

1. Install Wrangler:

   ```bash
   npm install -g wrangler
