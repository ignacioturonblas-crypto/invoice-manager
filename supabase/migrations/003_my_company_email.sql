-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/bdvtctnkjkxitotadvyv/sql/new
-- Adds email column to my_company table

ALTER TABLE my_company ADD COLUMN IF NOT EXISTS email TEXT;
