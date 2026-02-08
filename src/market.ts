import type { Env } from "./worker";

/**
 * Fetch recent momentum for a ticker (e.g., 5-day return).
 * Currently mocked; replace with real market data API.
 */
export async function fetchRecentMomentum(
  ticker: string,
  env: Env
): Promise<number> {
  // TODO: integrate real market data using env.MARKET_DATA_API_KEY
  // Mock: random-ish but deterministic per ticker
  let hash = 0;
  for (const ch of ticker) hash += ch.charCodeAt(0);
  const normalized = ((hash % 20) - 10) / 10; // between -1 and +1
  return normalized;
}
