-- bank_statements: one row per uploaded PDF
CREATE TABLE IF NOT EXISTS bank_statements (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_path  TEXT NOT NULL,
  file_name  TEXT NOT NULL,
  quarter    TEXT CHECK (quarter IN ('T1', 'T2', 'T3', 'T4')),
  year       INTEGER,
  status     TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'done', 'error')),
  raw_text   TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER bank_statements_updated_at
  BEFORE UPDATE ON bank_statements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE bank_statements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users can do everything"
  ON bank_statements FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- bank_transactions: one row per transaction extracted from a statement
CREATE TABLE IF NOT EXISTS bank_transactions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_id        UUID NOT NULL REFERENCES bank_statements(id) ON DELETE CASCADE,
  date                DATE,
  description         TEXT,
  amount              DECIMAL(10,2),           -- always positive
  direction           TEXT CHECK (direction IN ('debit', 'credit')),
  match_status        TEXT DEFAULT 'unmatched' CHECK (match_status IN ('matched', 'unmatched', 'dismissed')),
  matched_invoice_id  UUID REFERENCES invoices(id) ON DELETE SET NULL,
  manually_set        BOOLEAN DEFAULT false,   -- true when user explicitly changed the match
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_bank_transactions_statement ON bank_transactions(statement_id);
CREATE INDEX idx_bank_transactions_date_amount ON bank_transactions(date, amount);

CREATE TRIGGER bank_transactions_updated_at
  BEFORE UPDATE ON bank_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users can do everything"
  ON bank_transactions FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Storage bucket for bank statement PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('bank-statements', 'bank-statements', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "authenticated users can upload bank statements"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'bank-statements');

CREATE POLICY "authenticated users can read bank statements"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'bank-statements');

CREATE POLICY "authenticated users can delete bank statements"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'bank-statements');
