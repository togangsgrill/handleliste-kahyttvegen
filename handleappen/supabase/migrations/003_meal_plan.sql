-- ============================================================
-- Handleappen: Ukesmeny (meal_plan)
-- ============================================================

CREATE TABLE meal_plan (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  week_start   DATE NOT NULL,          -- Mandag i uken (YYYY-MM-DD)
  day_of_week  INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Man ... 6=Søn
  meal_type    TEXT NOT NULL DEFAULT 'dinner' CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'other')),
  recipe_id    UUID REFERENCES recipes(id) ON DELETE SET NULL,
  custom_name  TEXT,                   -- Fritekst hvis ingen oppskrift
  servings     INTEGER NOT NULL DEFAULT 4,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (household_id, week_start, day_of_week, meal_type)
);

CREATE INDEX idx_meal_plan_household_week ON meal_plan(household_id, week_start);

CREATE TRIGGER set_updated_at_meal_plan BEFORE UPDATE ON meal_plan
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE meal_plan ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meal_plan_household_select" ON meal_plan
  FOR SELECT USING (household_id = get_my_household_id());

CREATE POLICY "meal_plan_household_insert" ON meal_plan
  FOR INSERT WITH CHECK (household_id = get_my_household_id());

CREATE POLICY "meal_plan_household_update" ON meal_plan
  FOR UPDATE USING (household_id = get_my_household_id());

CREATE POLICY "meal_plan_household_delete" ON meal_plan
  FOR DELETE USING (household_id = get_my_household_id());
