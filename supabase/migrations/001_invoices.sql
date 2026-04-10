-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/bdvtctnkjkxitotadvyv/sql/new

-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  file_path       TEXT NOT NULL,
  file_name       TEXT NOT NULL,
  file_type       TEXT,
  type            TEXT NOT NULL DEFAULT 'payment' CHECK (type IN ('payment', 'income')),
  vendor          TEXT,
  date            DATE,
  amount          DECIMAL(10,2),
  currency        TEXT DEFAULT 'EUR',
  invoice_number  TEXT,
  tax_amount      DECIMAL(10,2),
  quarter         TEXT CHECK (quarter IN ('T1', 'T2', 'T3', 'T4')),
  year            INTEGER,
  category        TEXT,
  metadata        JSONB DEFAULT '{}',
  notes           TEXT,
  status          TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'done', 'error')),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Row Level Security
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users can do everything"
  ON invoices FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Storage bucket (run this separately if bucket doesn't exist)
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoices', 'invoices', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "authenticated users can upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'invoices');

CREATE POLICY "authenticated users can read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'invoices');

CREATE POLICY "authenticated users can delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'invoices');
