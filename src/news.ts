import type { Env } from "./worker";

export interface Headline {
  title: string;
  source: string;
  url: string;
  publishedAt: string;
}

/**
 * Universe of tickers to scan.
 * Replace with S&P 500 or your preferred universe later.
 */
export async function getUniverseTickers(): Promise<string[]> {
  return ["AAPL", "MSFT", "GOOGL", "AMZN", "META", "TSLA", "NVDA", "JPM", "XOM", "UNH"];
}

/**
 * Fetch headlines for a ticker between weekStart and weekEnd.
 * Currently returns mocked data; replace with real API calls.
 */
export async function fetchHeadlinesForTicker(
  ticker: string,
  weekStart: string,
  weekEnd: string,
  env: Env
): Promise<Headline[]> {
  // TODO: integrate real news API using env.NEWS_API_KEY
  // For now, return a simple synthetic headline so the pipeline works.
  return [
    {
      title: `${ticker} sees positive analyst coverage this week`,
      source: "MockNews",
      url: "https://example.com",
      publishedAt: `${weekEnd}T12:00:00Z`,
    },
  ];
}
