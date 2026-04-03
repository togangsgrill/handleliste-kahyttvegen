-- ============================================================
-- Handleappen: Row Level Security Policies
-- ============================================================

-- Helper: get current user's household_id
CREATE OR REPLACE FUNCTION get_my_household_id()
RETURNS UUID AS $$
  SELECT household_id FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- Enable RLS on all tables
-- ============================================================
ALTER TABLE households          ENABLE ROW LEVEL SECURITY;
ALTER TABLE users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories          ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_locations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_lists      ENABLE ROW LEVEL SECURITY;
ALTER TABLE list_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE list_item_comments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE list_activity       ENABLE ROW LEVEL SECURITY;
ALTER TABLE list_shares         ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_category_order ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE detected_visits     ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history       ENABLE ROW LEVEL SECURITY;
ALTER TABLE list_item_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ingredients  ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Households
-- ============================================================
CREATE POLICY "households_select" ON households FOR SELECT
  USING (id = get_my_household_id());

CREATE POLICY "households_insert" ON households FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "households_update" ON households FOR UPDATE
  USING (id = get_my_household_id());

-- ============================================================
-- Users
-- ============================================================
CREATE POLICY "users_select_own" ON users FOR SELECT
  USING (id = auth.uid() OR household_id = get_my_household_id());

CREATE POLICY "users_insert_own" ON users FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY "users_update_own" ON users FOR UPDATE
  USING (id = auth.uid());

-- ============================================================
-- Categories (global reference data, read-only for users)
-- ============================================================
CREATE POLICY "categories_select" ON categories FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ============================================================
-- Store Locations (global reference data)
-- ============================================================
CREATE POLICY "store_locations_select" ON store_locations FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "store_locations_insert" ON store_locations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================
-- Shopping Lists
-- ============================================================
CREATE POLICY "lists_select" ON shopping_lists FOR SELECT
  USING (
    household_id = get_my_household_id()
    AND (visibility = 'shared' OR created_by = auth.uid())
  );

CREATE POLICY "lists_insert" ON shopping_lists FOR INSERT
  WITH CHECK (household_id = get_my_household_id());

CREATE POLICY "lists_update" ON shopping_lists FOR UPDATE
  USING (
    household_id = get_my_household_id()
    AND (visibility = 'shared' OR created_by = auth.uid())
  );

CREATE POLICY "lists_delete" ON shopping_lists FOR DELETE
  USING (created_by = auth.uid());

-- ============================================================
-- List Items (access follows parent list)
-- ============================================================
CREATE POLICY "items_select" ON list_items FOR SELECT
  USING (
    list_id IN (
      SELECT id FROM shopping_lists
      WHERE household_id = get_my_household_id()
        AND (visibility = 'shared' OR created_by = auth.uid())
    )
  );

CREATE POLICY "items_insert" ON list_items FOR INSERT
  WITH CHECK (
    list_id IN (
      SELECT id FROM shopping_lists
      WHERE household_id = get_my_household_id()
    )
  );

CREATE POLICY "items_update" ON list_items FOR UPDATE
  USING (
    list_id IN (
      SELECT id FROM shopping_lists
      WHERE household_id = get_my_household_id()
        AND (visibility = 'shared' OR created_by = auth.uid())
    )
  );

CREATE POLICY "items_delete" ON list_items FOR DELETE
  USING (
    list_id IN (
      SELECT id FROM shopping_lists
      WHERE household_id = get_my_household_id()
        AND (visibility = 'shared' OR created_by = auth.uid())
    )
  );

-- ============================================================
-- List Item Comments
-- ============================================================
CREATE POLICY "comments_select" ON list_item_comments FOR SELECT
  USING (
    list_item_id IN (
      SELECT li.id FROM list_items li
      JOIN shopping_lists sl ON li.list_id = sl.id
      WHERE sl.household_id = get_my_household_id()
    )
  );

CREATE POLICY "comments_insert" ON list_item_comments FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- List Activity
-- ============================================================
CREATE POLICY "activity_select" ON list_activity FOR SELECT
  USING (
    list_id IN (
      SELECT id FROM shopping_lists
      WHERE household_id = get_my_household_id()
    )
  );

CREATE POLICY "activity_insert" ON list_activity FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- List Shares
-- ============================================================
CREATE POLICY "shares_select" ON list_shares FOR SELECT
  USING (
    list_id IN (
      SELECT id FROM shopping_lists
      WHERE household_id = get_my_household_id()
    )
  );

CREATE POLICY "shares_insert" ON list_shares FOR INSERT
  WITH CHECK (created_by = auth.uid());

-- ============================================================
-- User Category Order
-- ============================================================
CREATE POLICY "category_order_select" ON user_category_order FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "category_order_all" ON user_category_order FOR ALL
  USING (user_id = auth.uid());

-- ============================================================
-- Shopping Sessions
-- ============================================================
CREATE POLICY "sessions_select" ON shopping_sessions FOR SELECT
  USING (household_id = get_my_household_id());

CREATE POLICY "sessions_insert" ON shopping_sessions FOR INSERT
  WITH CHECK (household_id = get_my_household_id());

CREATE POLICY "sessions_update" ON shopping_sessions FOR UPDATE
  USING (household_id = get_my_household_id());

-- ============================================================
-- Detected Visits
-- ============================================================
CREATE POLICY "visits_select" ON detected_visits FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "visits_insert" ON detected_visits FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "visits_update" ON detected_visits FOR UPDATE
  USING (user_id = auth.uid());

-- ============================================================
-- Receipts
-- ============================================================
CREATE POLICY "receipts_select" ON receipts FOR SELECT
  USING (household_id = get_my_household_id());

CREATE POLICY "receipts_insert" ON receipts FOR INSERT
  WITH CHECK (household_id = get_my_household_id());

-- ============================================================
-- Receipt Items
-- ============================================================
CREATE POLICY "receipt_items_select" ON receipt_items FOR SELECT
  USING (
    receipt_id IN (
      SELECT id FROM receipts
      WHERE household_id = get_my_household_id()
    )
  );

CREATE POLICY "receipt_items_insert" ON receipt_items FOR INSERT
  WITH CHECK (
    receipt_id IN (
      SELECT id FROM receipts
      WHERE household_id = get_my_household_id()
    )
  );

CREATE POLICY "receipt_items_update" ON receipt_items FOR UPDATE
  USING (
    receipt_id IN (
      SELECT id FROM receipts
      WHERE household_id = get_my_household_id()
    )
  );

-- ============================================================
-- Price History
-- ============================================================
CREATE POLICY "price_history_select" ON price_history FOR SELECT
  USING (household_id = get_my_household_id());

CREATE POLICY "price_history_insert" ON price_history FOR INSERT
  WITH CHECK (household_id = get_my_household_id());

-- ============================================================
-- AI Suggestions
-- ============================================================
CREATE POLICY "suggestions_select" ON list_item_suggestions FOR SELECT
  USING (
    list_id IN (
      SELECT id FROM shopping_lists
      WHERE household_id = get_my_household_id()
    )
  );

CREATE POLICY "suggestions_insert" ON list_item_suggestions FOR INSERT
  WITH CHECK (
    list_id IN (
      SELECT id FROM shopping_lists
      WHERE household_id = get_my_household_id()
    )
  );

CREATE POLICY "suggestions_update" ON list_item_suggestions FOR UPDATE
  USING (
    list_id IN (
      SELECT id FROM shopping_lists
      WHERE household_id = get_my_household_id()
    )
  );

-- ============================================================
-- Recipes
-- ============================================================
CREATE POLICY "recipes_select" ON recipes FOR SELECT
  USING (household_id = get_my_household_id());

CREATE POLICY "recipes_insert" ON recipes FOR INSERT
  WITH CHECK (household_id = get_my_household_id());

CREATE POLICY "recipes_update" ON recipes FOR UPDATE
  USING (household_id = get_my_household_id());

-- ============================================================
-- Recipe Ingredients
-- ============================================================
CREATE POLICY "ingredients_select" ON recipe_ingredients FOR SELECT
  USING (
    recipe_id IN (
      SELECT id FROM recipes
      WHERE household_id = get_my_household_id()
    )
  );

CREATE POLICY "ingredients_insert" ON recipe_ingredients FOR INSERT
  WITH CHECK (
    recipe_id IN (
      SELECT id FROM recipes
      WHERE household_id = get_my_household_id()
    )
  );
