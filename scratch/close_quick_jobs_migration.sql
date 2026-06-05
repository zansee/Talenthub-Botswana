-- Alter quick_jobs table to add columns for closing metadata
ALTER TABLE public.quick_jobs
ADD COLUMN IF NOT EXISTS close_reason TEXT,
ADD COLUMN IF NOT EXISTS close_text TEXT,
ADD COLUMN IF NOT EXISTS hired_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS hired_user_name TEXT,
ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
