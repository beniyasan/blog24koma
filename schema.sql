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
