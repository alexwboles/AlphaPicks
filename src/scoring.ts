import type { Headline } from "./news";

/**
 * Very simple sentiment scoring based on keywords.
 * Replace with LLM or sentiment API later.
 */
export function scoreSentiment(headlines: Headline[]): number {
  const positiveWords = ["beat", "strong", "growth", "upgrade", "record", "surge", "bullish"];
  const negativeWords = ["miss", "weak", "downgrade", "lawsuit", "probe", "regulatory", "fraud"];

  let score = 0;
  let count = 0;

  for (const h of headlines) {
    const text = h.title.toLowerCase();
    let s = 0;

    for (const w of positiveWords) {
      if (text.includes(w)) s += 1;
    }
    for (const w of negativeWords) {
      if (text.includes(w)) s -= 1;
    }

    score += s;
    count += 1;
  }

  if (count === 0) return 0;
  return score / count; // average sentiment per headline
}

/**
 * Simple event detection: earnings, upgrades, etc.
 * Returns a numeric boost/penalty.
 */
export function detectEvents(headlines: Headline[]): number {
  let score = 0;

  for (const h of headlines) {
    const text = h.title.toLowerCase();

    if (text.includes("earnings") && text.includes("beat")) score += 2;
    if (text.includes("earnings") && text.includes("miss")) score -= 2;
    if (text.includes("upgrade")) score += 1.5;
    if (text.includes("downgrade")) score -= 1.5;
    if (text.includes("acquisition") || text.includes("merger")) score += 1;
    if (text.includes("lawsuit") || text.includes("probe") || text.includes("regulatory"))
      score -= 2;
  }

  return score;
}
