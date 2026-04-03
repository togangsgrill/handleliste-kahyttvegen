-- ============================================================
-- Handleappen: Core Tables
-- ============================================================

-- Auto-update updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 1. Households
-- ============================================================
CREATE TABLE households (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER set_updated_at_households BEFORE UPDATE ON households
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 2. Users (extends auth.users)
-- ============================================================
CREATE TABLE users (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  household_id  UUID REFERENCES households(id),
  display_name  TEXT NOT NULL DEFAULT 'Anonym bruker',
  auth_provider TEXT NOT NULL DEFAULT 'anonymous',
  is_upgraded   BOOLEAN NOT NULL DEFAULT false,
  deleted_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_users_household ON users(household_id);
CREATE TRIGGER set_updated_at_users BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 3. Categories
-- ============================================================
CREATE TABLE categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  emoji      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER set_updated_at_categories BEFORE UPDATE ON categories
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 4. Store Locations
-- ============================================================
CREATE TABLE store_locations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chain      TEXT NOT NULL,
  name       TEXT NOT NULL,
  address    TEXT,
  lat        DOUBLE PRECISION,
  lng        DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER set_updated_at_store_locations BEFORE UPDATE ON store_locations
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 5. Shopping Lists
-- ============================================================
CREATE TABLE shopping_lists (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id),
  created_by   UUID NOT NULL REFERENCES users(id),
  name         TEXT NOT NULL,
  visibility   TEXT NOT NULL DEFAULT 'shared' CHECK (visibility IN ('shared', 'private')),
  is_deleted   BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_lists_household ON shopping_lists(household_id);
CREATE TRIGGER set_updated_at_shopping_lists BEFORE UPDATE ON shopping_lists
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 6. List Items
-- ============================================================
CREATE TABLE list_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id     UUID NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  category_id UUID REFERENCES categories(id),
  quantity    INTEGER NOT NULL DEFAULT 1,
  is_checked  BOOLEAN NOT NULL DEFAULT false,
  checked_by  UUID REFERENCES users(id),
  checked_at  TIMESTAMPTZ,
  added_by    UUID NOT NULL REFERENCES users(id),
  note        TEXT,
  image_url   TEXT,
  barcode     TEXT,
  recipe_id   UUID,
  is_deleted  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_items_list ON list_items(list_id);
CREATE TRIGGER set_updated_at_list_items BEFORE UPDATE ON list_items
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 7. List Item Comments
-- ============================================================
CREATE TABLE list_item_comments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_item_id UUID NOT NULL REFERENCES list_items(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id),
  comment      TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER set_updated_at_list_item_comments BEFORE UPDATE ON list_item_comments
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 8. List Activity Log
-- ============================================================
CREATE TABLE list_activity (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id    UUID NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id),
  action     TEXT NOT NULL CHECK (action IN ('added', 'checked', 'unchecked', 'removed', 'edited')),
  item_name  TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_activity_list ON list_activity(list_id);

-- ============================================================
-- 9. List Shares
-- ============================================================
CREATE TABLE list_shares (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id     UUID NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
  share_token TEXT NOT NULL UNIQUE,
  permission  TEXT NOT NULL DEFAULT 'view' CHECK (permission IN ('view', 'edit')),
  expires_at  TIMESTAMPTZ,
  created_by  UUID NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 10. User Category Order
-- ============================================================
CREATE TABLE user_category_order (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id),
  store_location_id UUID NOT NULL REFERENCES store_locations(id),
  category_id       UUID NOT NULL REFERENCES categories(id),
  sort_order        INTEGER NOT NULL DEFAULT 0,
  UNIQUE (user_id, store_location_id, category_id)
);

-- ============================================================
-- 11. Shopping Sessions
-- ============================================================
CREATE TABLE shopping_sessions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id           UUID REFERENCES shopping_lists(id),
  household_id      UUID NOT NULL REFERENCES households(id),
  store_location_id UUID REFERENCES store_locations(id),
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at      TIMESTAMPTZ,
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER set_updated_at_shopping_sessions BEFORE UPDATE ON shopping_sessions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 12. Detected Visits (Strava-style detection)
-- ============================================================
CREATE TABLE detected_visits (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id),
  store_location_id UUID NOT NULL REFERENCES store_locations(id),
  session_id        UUID REFERENCES shopping_sessions(id),
  detected_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'dismissed')),
  expires_at        TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  confirmed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER set_updated_at_detected_visits BEFORE UPDATE ON detected_visits
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 13. Receipts
-- ============================================================
CREATE TABLE receipts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id      UUID NOT NULL REFERENCES households(id),
  store_location_id UUID REFERENCES store_locations(id),
  session_id        UUID REFERENCES shopping_sessions(id),
  image_url         TEXT,
  total_amount      NUMERIC,
  purchased_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER set_updated_at_receipts BEFORE UPDATE ON receipts
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 14. Receipt Items
-- ============================================================
CREATE TABLE receipt_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id   UUID NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  quantity     NUMERIC,
  unit_price   NUMERIC,
  total_price  NUMERIC,
  is_corrected BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER set_updated_at_receipt_items BEFORE UPDATE ON receipt_items
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 15. Price History
-- ============================================================
CREATE TABLE price_history (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id      UUID NOT NULL REFERENCES households(id),
  item_name         TEXT NOT NULL,
  store_location_id UUID NOT NULL REFERENCES store_locations(id),
  unit_price        NUMERIC NOT NULL,
  observed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  receipt_id        UUID REFERENCES receipts(id),
  confidence        DOUBLE PRECISION NOT NULL DEFAULT 0.5
);
CREATE INDEX idx_price_history_item ON price_history(item_name, store_location_id);

-- ============================================================
-- 16. AI Suggestions
-- ============================================================
CREATE TABLE list_item_suggestions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id     UUID NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  category_id UUID REFERENCES categories(id),
  suggested_by TEXT NOT NULL DEFAULT 'ai' CHECK (suggested_by IN ('ai', 'history')),
  confidence  DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'dismissed')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 17. Recipes
-- ============================================================
CREATE TABLE recipes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id      UUID NOT NULL REFERENCES households(id),
  name              TEXT NOT NULL,
  base_servings     INTEGER NOT NULL DEFAULT 4,
  image_url         TEXT,
  source_type       TEXT DEFAULT 'unknown' CHECK (source_type IN ('instagram', 'tiktok', 'web', 'book', 'unknown')),
  source_label      TEXT,
  source_url        TEXT,
  source_confidence DOUBLE PRECISION DEFAULT 0.0,
  description       TEXT,
  description_is_ai BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER set_updated_at_recipes BEFORE UPDATE ON recipes
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 18. Recipe Ingredients
-- ============================================================
CREATE TABLE recipe_ingredients (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id   UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  quantity    NUMERIC,
  unit        TEXT,
  category_id UUID REFERENCES categories(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Enable Realtime for key tables
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE shopping_lists;
ALTER PUBLICATION supabase_realtime ADD TABLE list_items;
ALTER PUBLICATION supabase_realtime ADD TABLE list_activity;
