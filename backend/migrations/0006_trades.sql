-- Migration: 0006_trades
-- Trades system: trade offers, trade items, and notifications

-- ── Trades ────────────────────────────────────────────────────────────────────
-- A trade is an offer from one user to another, exchanging collection items.
CREATE TABLE IF NOT EXISTS trades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  initiator_id INTEGER NOT NULL,        -- user who sent the offer
  recipient_id INTEGER NOT NULL,        -- user who received the offer
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending', 'accepted', 'declined', 'cancelled', 'completed')),
  message TEXT,                          -- optional note from initiator
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (initiator_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_trades_initiator ON trades(initiator_id);
CREATE INDEX IF NOT EXISTS idx_trades_recipient ON trades(recipient_id);
CREATE INDEX IF NOT EXISTS idx_trades_status    ON trades(status);

-- ── Trade Items ───────────────────────────────────────────────────────────────
-- Each trade has two sides: items offered by the initiator and items requested
-- from the recipient. direction = 'offer' | 'request'.
CREATE TABLE IF NOT EXISTS trade_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trade_id INTEGER NOT NULL,
  collection_item_id INTEGER NOT NULL,
  direction TEXT NOT NULL CHECK(direction IN ('offer', 'request')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (trade_id) REFERENCES trades(id) ON DELETE CASCADE,
  FOREIGN KEY (collection_item_id) REFERENCES collection_items(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_trade_items_trade      ON trade_items(trade_id);
CREATE INDEX IF NOT EXISTS idx_trade_items_collection ON trade_items(collection_item_id);

-- ── Notifications ─────────────────────────────────────────────────────────────
-- Generic notification row; type drives UI rendering.
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL,                    -- e.g. 'trade_offer', 'trade_accepted', 'trade_declined'
  title TEXT NOT NULL,
  body TEXT,
  trade_id INTEGER,                      -- optional link to a trade
  read INTEGER NOT NULL DEFAULT 0,       -- 0 = unread, 1 = read
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (trade_id) REFERENCES trades(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_user    ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread  ON notifications(user_id, read);
