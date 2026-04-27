<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Data Model Rules

## Shared data — no per-user scoping
All app data (suppliers, my_company, invoices, and any future tables) is **shared across all authenticated users**. This is a two-person app (Ignacio + partner) where both accounts should see and edit the same data.

Rules to always follow:
- RLS policies must use `auth.role() = 'authenticated'` — never `auth.uid() = user_id`
- Never add `.eq("user_id", user.id)` filters to queries
- Never include `user_id` or `created_by` as ownership/scoping columns in new tables (audit columns are OK but must not gate access)
- New migrations must not create per-user UNIQUE constraints
