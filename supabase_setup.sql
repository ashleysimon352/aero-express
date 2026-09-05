-- ============================================================================
-- AERO EXPRESS - SUPABASE CLOUD DATABASE SETUP SCRIPT
-- Run this in your Supabase Dashboard: SQL Editor -> New Query -> Run
-- ============================================================================

-- 1. Create the shipments table if it doesn't already exist
CREATE TABLE IF NOT EXISTS public.shipments (
  code TEXT PRIMARY KEY,
  status TEXT,
  origin TEXT,
  destination TEXT,
  sender_name TEXT,
  receiver_name TEXT,
  payload JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies if re-running script
DROP POLICY IF EXISTS "Allow public full access" ON public.shipments;
DROP POLICY IF EXISTS "Allow public tracking read" ON public.shipments;
DROP POLICY IF EXISTS "Allow public insert" ON public.shipments;
DROP POLICY IF EXISTS "Allow public modify" ON public.shipments;
DROP POLICY IF EXISTS "Allow public delete" ON public.shipments;

-- 4. Create Policy for anon/publishable key:
-- Allows Select (Client Tracking), Insert/Upsert (Admin Dispatch), Update (Timeline Editor), and Delete
CREATE POLICY "Allow public full access"
  ON public.shipments FOR ALL
  USING (true)
  WITH CHECK (true);

-- Index for high-speed queries on tracking code and updated_at
CREATE INDEX IF NOT EXISTS idx_shipments_code ON public.shipments (code);
CREATE INDEX IF NOT EXISTS idx_shipments_updated_at ON public.shipments (updated_at DESC);
