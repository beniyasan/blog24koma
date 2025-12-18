-- Users table for storing account information
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,                    -- Cloudflare Access ID (from JWT sub claim)
    email TEXT UNIQUE NOT NULL,             -- User email
    plan TEXT DEFAULT 'free',               -- free, lite, pro
    stripe_customer_id TEXT,                -- Stripe Customer ID
    stripe_subscription_id TEXT,            -- Active subscription ID
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Usage tracking for monthly limits
CREATE TABLE IF NOT EXISTS usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,                  -- References users.id
    type TEXT NOT NULL,                     -- 'blog' or 'movie'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Index for faster usage queries
CREATE INDEX IF NOT EXISTS idx_usage_user_month ON usage(user_id, created_at);

-- Consent evidence for checkout (chargeback/dispute support)
CREATE TABLE IF NOT EXISTS consents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    kind TEXT NOT NULL,                     -- e.g. 'subscription_checkout'
    version TEXT NOT NULL,                  -- app-defined consent version
    accepted_at DATETIME NOT NULL,
    ip TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_consents_user_kind_time ON consents(user_id, kind, accepted_at);

-- Stripe webhook event idempotency / evidence
CREATE TABLE IF NOT EXISTS stripe_events (
    id TEXT PRIMARY KEY,                    -- Stripe event id
    type TEXT NOT NULL,
    created INTEGER,                        -- Stripe event.created (unix seconds)
    received_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_stripe_events_type_received ON stripe_events(type, received_at);
