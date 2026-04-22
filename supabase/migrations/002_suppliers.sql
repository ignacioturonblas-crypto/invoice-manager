-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/bdvtctnkjkxitotadvyv/sql/new
-- NOTE: update_updated_at() function already exists from migration 001 — do not re-create it.

-- Suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  business_name    TEXT NOT NULL,
  vat_number       TEXT,
  address          TEXT,
  shipping_address TEXT,
  zip_code         TEXT,
  country          TEXT,
  contact_person   TEXT,
  phone            TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER suppliers_updated_at
  BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users can do everything"
  ON suppliers FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- My company profile table (one row per user)
CREATE TABLE IF NOT EXISTS my_company (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  business_name    TEXT,
  vat_number       TEXT,
  billing_address  TEXT,
  shipping_address TEXT,
  zip_code         TEXT,
  country          TEXT,
  contact_person   TEXT,
  phone            TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER my_company_updated_at
  BEFORE UPDATE ON my_company
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE my_company ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own company"
  ON my_company FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
