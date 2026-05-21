-- Migration 010: Outreach CRM
-- Tables: searches, contacts, campaigns, contact_outreach

-- Track Google Places searches
CREATE TABLE IF NOT EXISTS searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query text NOT NULL,
  category text NOT NULL,
  city text,
  country text DEFAULT 'ES',
  total_found int DEFAULT 0,
  imported_count int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE searches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage searches"
  ON searches FOR ALL
  USING (auth.role() = 'authenticated');

-- Core contacts/leads database
CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'interior_studio',
  -- category values: interior_studio | retailer | wholesale | gallery | architect | hospitality | staging | other
  address text,
  city text,
  country text DEFAULT 'ES',
  phone text,
  website text,
  email text,
  google_place_id text UNIQUE,
  rating numeric,
  reviews_count int,
  source_search_id uuid REFERENCES searches(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'new',
  -- status values: new | contacted | replied | client | rejected | unsubscribed
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage contacts"
  ON contacts FOR ALL
  USING (auth.role() = 'authenticated');

CREATE INDEX idx_contacts_category ON contacts(category);
CREATE INDEX idx_contacts_status ON contacts(status);
CREATE INDEX idx_contacts_city ON contacts(city);
CREATE INDEX idx_contacts_google_place_id ON contacts(google_place_id);

-- Email campaign templates
CREATE TABLE IF NOT EXISTS campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  category text, -- optional: target a specific contact category
  wholesale_link text,
  calendly_link text,
  status text NOT NULL DEFAULT 'draft',
  -- status values: draft | active | paused
  sent_count int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage campaigns"
  ON campaigns FOR ALL
  USING (auth.role() = 'authenticated');

-- Join: which contact received which campaign
CREATE TABLE IF NOT EXISTS contact_outreach (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  email_used text,
  status text NOT NULL DEFAULT 'pending',
  -- status values: pending | sent | replied | converted | unsubscribed
  sent_at timestamptz,
  replied_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(contact_id, campaign_id)
);

ALTER TABLE contact_outreach ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage contact_outreach"
  ON contact_outreach FOR ALL
  USING (auth.role() = 'authenticated');

CREATE INDEX idx_contact_outreach_contact ON contact_outreach(contact_id);
CREATE INDEX idx_contact_outreach_campaign ON contact_outreach(campaign_id);
CREATE INDEX idx_contact_outreach_status ON contact_outreach(status);

-- Helper RPC to safely increment campaign sent_count
CREATE OR REPLACE FUNCTION increment_campaign_sent(campaign_id uuid, count int)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE campaigns SET sent_count = sent_count + count WHERE id = campaign_id;
$$;

-- Seed default campaign template
INSERT INTO campaigns (name, subject, body, category, wholesale_link, calendly_link, status)
VALUES (
  'Cold Outreach — Interiorismo',
  'Colaboración — productos de decoración y arte para vuestros proyectos',
  'Hola {{name}},

Me pongo en contacto contigo porque creo que nuestra colección podría encajar muy bien con vuestros proyectos y espacio.

Trabajamos con obra original, encargos personalizados y una línea de productos de decoración del hogar — lámparas, textiles, velas, floreros y más — disponibles bajo programa de mayorista.

Puedes ver las condiciones y registrarte aquí: {{wholesale_link}}

Si prefieres una presentación rápida, puedes reservar un momento en nuestro calendario: {{calendly_link}}

Quedo a tu disposición para cualquier pregunta.

Saludos',
  'interior_studio',
  '',
  '',
  'draft'
);
