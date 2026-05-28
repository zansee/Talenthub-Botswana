-- Fix RLS policies for interview_preps table
-- Ensure RLS is enabled
ALTER TABLE public.interview_preps ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid duplicates
DROP POLICY IF EXISTS "Users can view own interview_preps" ON public.interview_preps;
DROP POLICY IF EXISTS "Users can insert own interview_preps" ON public.interview_preps;
DROP POLICY IF EXISTS "Partners can view all interview_preps" ON public.interview_preps;
DROP POLICY IF EXISTS "Partners can update interview_preps" ON public.interview_preps;
DROP POLICY IF EXISTS "Users can update own interview_preps" ON public.interview_preps;

-- Allow users to view their own requests
CREATE POLICY "Users can view own interview_preps"
  ON public.interview_preps FOR SELECT
  USING (auth.uid() = user_id);

-- Allow users to insert their own requests
CREATE POLICY "Users can insert own interview_preps"
  ON public.interview_preps FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own requests
CREATE POLICY "Users can update own interview_preps"
  ON public.interview_preps FOR UPDATE
  USING (auth.uid() = user_id);

-- Allow partners and admins to view ALL requests
CREATE POLICY "Partners can view all interview_preps"
  ON public.interview_preps FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('partner', 'admin')
    )
  );

-- Allow partners and admins to update ALL requests
CREATE POLICY "Partners can update interview_preps"
  ON public.interview_preps FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('partner', 'admin')
    )
  );

-- Ensure the table has all required columns (add any missing ones)
ALTER TABLE public.interview_preps
  ADD COLUMN IF NOT EXISTS session_scheduled_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS meeting_link TEXT,
  ADD COLUMN IF NOT EXISTS script_path TEXT,
  ADD COLUMN IF NOT EXISTS partner_notes TEXT,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS additional_attachment_paths TEXT[];
