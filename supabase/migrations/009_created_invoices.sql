CREATE TABLE IF NOT EXISTS created_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL,
  invoice_date DATE NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('outgoing','incoming')),
  -- From (seller)
  from_name TEXT,
  from_vat TEXT,
  from_address TEXT,
  from_zip TEXT,
  from_country TEXT,
  from_phone TEXT,
  from_email TEXT,
  -- Bill to (buyer)
  bill_to_name TEXT,
  bill_to_vat TEXT,
  bill_to_address TEXT,
  bill_to_zip TEXT,
  bill_to_country TEXT,
  -- Ship to (optional)
  ship_to_name TEXT,
  ship_to_address TEXT,
  ship_to_zip TEXT,
  ship_to_country TEXT,
  -- Order ref
  order_reference TEXT,
  -- Line items
  line_items JSONB NOT NULL DEFAULT '[]',
  -- Totals
  shipping_amount DECIMAL(10,2) DEFAULT 0,
  vat_rate DECIMAL(5,2) DEFAULT 21,
  notes TEXT,
  -- Optional supplier link
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE created_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated can manage created_invoices" ON created_invoices
  FOR ALL USING (auth.role() = 'authenticated');

CREATE INDEX IF NOT EXISTS created_invoices_invoice_date_idx ON created_invoices (invoice_date DESC);
