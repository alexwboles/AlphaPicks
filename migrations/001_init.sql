-- weeks: one row per weekly drop
CREATE TABLE weeks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week_start TEXT NOT NULL,   -- ISO date string (YYYY-MM-DD)
  week_end   TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- picks: 5 per week
CREATE TABLE picks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week_id INTEGER NOT NULL REFERENCES weeks(id),
  ticker TEXT NOT NULL,
  score REAL NOT NULL,
  rank INTEGER NOT NULL,
  rationale TEXT,             -- JSON string: headlines, sentiment, events
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- users: minimal auth (stubbed for now)
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- stripe mapping
CREATE TABLE stripe_customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  stripe_customer_id TEXT NOT NULL,
  subscription_status TEXT NOT NULL,
  current_period_end TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- user access (for future one-off unlocks)
CREATE TABLE user_access (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  week_id INTEGER NOT NULL REFERENCES weeks(id),
  access_type TEXT NOT NULL,  -- 'subscription' or 'one_time'
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
