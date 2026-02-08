import Stripe from "stripe";
import { getUserIdFromRequest } from "./auth";
import { getUniverseTickers, fetchHeadlinesForTicker } from "./news";
import { fetchRecentMomentum } from "./market";
import { scoreSentiment, detectEvents } from "./scoring";

export interface Env {
  DB: D1Database;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  NEWS_API_KEY: string;
  MARKET_DATA_API_KEY: string;
}

function stripeClient(env: Env) {
  return new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: "2023-10-16",
  });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Basic router
    if (path === "/api/picks/current" && method === "GET") {
      return getCurrentPicks(request, env);
    }

    if (path === "/api/stripe/create-checkout-session" && method === "POST") {
      return createCheckoutSession(request, env);
    }

    if (path === "/api/stripe/webhook" && method === "POST") {
      return handleStripeWebhook(request, env);
    }

    return new Response("Not found", { status: 404 });
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runWeeklyJob(env));
  },
};

// -------------------- Weekly job --------------------

async function runWeeklyJob(env: Env): Promise<void> {
  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() - 1); // last full day = Saturday
  const start = new Date(end);
  start.setDate(start.getDate() - 6); // previous Sunday

  const weekStart = start.toISOString().slice(0, 10);
  const weekEnd = end.toISOString().slice(0, 10);

  // create week row
  const result = await env.DB.prepare(
    "INSERT INTO weeks (week_start, week_end) VALUES (?, ?)"
  )
    .bind(weekStart, weekEnd)
    .run();

  const weekId = result.lastRowId;
  if (!weekId) return;

  const tickers = await getUniverseTickers();
  const scored: {
    ticker: string;
    score: number;
    rank?: number;
    rationale: any;
  }[] = [];

  for (const ticker of tickers) {
    const headlines = await fetchHeadlinesForTicker(ticker, weekStart, weekEnd, env);
    if (!headlines.length) continue;

    const sentimentScore = scoreSentiment(headlines);
    const eventScore = detectEvents(headlines);
    const momentum = await fetchRecentMomentum(ticker, env);

    const score = 0.5 * sentimentScore + 0.3 * eventScore + 0.2 * momentum;

    scored.push({
      ticker,
      score,
      rationale: { headlines, sentimentScore, eventScore, momentum },
    });
  }

  scored.sort((a, b) => b.score - a.score);
  const top5 = scored.slice(0, 5).map((p, idx) => ({ ...p, rank: idx + 1 }));

  const stmt = env.DB.prepare(
    "INSERT INTO picks (week_id, ticker, score, rank, rationale) VALUES (?, ?, ?, ?, ?)"
  );

  for (const p of top5) {
    await stmt
      .bind(weekId, p.ticker, p.score, p.rank, JSON.stringify(p.rationale))
      .run();
  }
}

// -------------------- Picks API --------------------

async function getCurrentPicks(request: Request, env: Env): Promise<Response> {
  const userId = await getUserIdFromRequest(request, env);
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const week = await env.DB
    .prepare("SELECT * FROM weeks ORDER BY id DESC LIMIT 1")
    .first();

  if (!week) {
    return Response.json({ locked: false, week: null, picks: [] });
  }

  const sub = await env.DB
    .prepare(
      "SELECT subscription_status, current_period_end FROM stripe_customers WHERE user_id = ?"
    )
    .bind(userId)
    .first();

  const hasActiveSub =
    sub &&
    (sub.subscription_status === "active" || sub.subscription_status === "trialing") &&
    new Date(sub.current_period_end) > new Date();

  if (!hasActiveSub) {
    return Response.json({ locked: true });
  }

  const picks = await env.DB
    .prepare(
      "SELECT ticker, score, rank, rationale FROM picks WHERE week_id = ? ORDER BY rank ASC"
    )
    .bind(week.id)
    .all();

  return Response.json({
    locked: false,
    week: { start: week.week_start, end: week.week_end },
    picks: picks.results.map((p: any) => ({
      ticker: p.ticker,
      score: p.score,
      rank: p.rank,
      rationale: JSON.parse(p.rationale),
    })),
  });
}

// -------------------- Stripe: checkout --------------------

async function createCheckoutSession(request: Request, env: Env): Promise<Response> {
  const userId = await getUserIdFromRequest(request, env);
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const stripe = stripeClient(env);
  const body = await request.json().catch(() => ({}));
  const priceId = body.priceId || "price_YOUR_WEEKLY_PLAN"; // TODO: replace

  const userRow = await env.DB
    .prepare("SELECT * FROM stripe_customers WHERE user_id = ?")
    .bind(userId)
    .first();

  let customerId: string | undefined = userRow?.stripe_customer_id;

  if (!customerId) {
    const user = await env.DB
      .prepare("SELECT email FROM users WHERE id = ?")
      .bind(userId)
      .first();

    const customer = await stripe.customers.create({
      email: user?.email || undefined,
    });

    customerId = customer.id;

    await env.DB
      .prepare(
        "INSERT INTO stripe_customers (user_id, stripe_customer_id, subscription_status) VALUES (?, ?, ?)"
      )
      .bind(userId, customerId, "pending")
      .run();
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: "https://your-domain.com/picks?status=success",
    cancel_url: "https://your-domain.com/picks?status=cancel",
  });

  return Response.json({ url: session.url });
}

// -------------------- Stripe: webhook --------------------

async function handleStripeWebhook(request: Request, env: Env): Promise<Response> {
  const sig = request.headers.get("stripe-signature") || "";
  const rawBody = await request.text();
  const stripe = stripeClient(env);

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err: any) {
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated"
  ) {
    const sub = event.data.object as Stripe.Subscription;
    const customerId = sub.customer as string;

    const row = await env.DB
      .prepare("SELECT user_id FROM stripe_customers WHERE stripe_customer_id = ?")
      .bind(customerId)
      .first();

    if (row) {
      await env.DB
        .prepare(
          "UPDATE stripe_customers SET subscription_status = ?, current_period_end = ? WHERE stripe_customer_id = ?"
        )
        .bind(
          sub.status,
          new Date(sub.current_period_end! * 1000).toISOString(),
          customerId
        )
        .run();
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;
    const customerId = sub.customer as string;

    await env.DB
      .prepare(
        "UPDATE stripe_customers SET subscription_status = ? WHERE stripe_customer_id = ?"
      )
      .bind("canceled", customerId)
      .run();
  }

  return new Response("ok", { status: 200 });
}
