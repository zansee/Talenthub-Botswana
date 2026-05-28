-- 1. Create Companies Table
CREATE TABLE IF NOT EXISTS public.companies (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_user_id uuid REFERENCES auth.users(id),
  name text NOT NULL,
  tagline text,
  description text,
  website text,
  location text,
  industry text,
  employee_count text,
  founded_year int,
  logo_url text,
  subscription_tier text DEFAULT 'free',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- 2. Create Company Members Table
CREATE TABLE IF NOT EXISTS public.company_members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role text DEFAULT 'recruiter' NOT NULL CHECK (role IN ('admin', 'hiring_manager', 'recruiter')),
  invited_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(company_id, user_id)
);
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;

-- 3. Create CV Requests Table
CREATE TABLE IF NOT EXISTS public.cv_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'declined'
  cv_path text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.cv_requests ENABLE ROW LEVEL SECURITY;

-- 4. Create Employer Audit Logs
CREATE TABLE IF NOT EXISTS public.employer_audit_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  description text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.employer_audit_logs ENABLE ROW LEVEL SECURITY;

-- 5. Create Highlighted Candidates
CREATE TABLE IF NOT EXISTS public.highlighted_candidates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  employer_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  note text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(candidate_id, employer_id)
);
ALTER TABLE public.highlighted_candidates ENABLE ROW LEVEL SECURITY;

-- 6. Add columns to applications
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS recruiter_notes TEXT,
  ADD COLUMN IF NOT EXISTS starred BOOLEAN DEFAULT false;

-- 7. Add columns to jobs
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

-- 8. Add application_status enum values safely
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'application_status'::regtype AND enumlabel = 'reviewing') THEN
    ALTER TYPE application_status ADD VALUE 'reviewing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'application_status'::regtype AND enumlabel = 'shortlisted') THEN
    ALTER TYPE application_status ADD VALUE 'shortlisted';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'application_status'::regtype AND enumlabel = 'interview') THEN
    ALTER TYPE application_status ADD VALUE 'interview';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'application_status'::regtype AND enumlabel = 'hired') THEN
    ALTER TYPE application_status ADD VALUE 'hired';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'application_status'::regtype AND enumlabel = 'declined') THEN
    ALTER TYPE application_status ADD VALUE 'declined';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Security Definer Function for RLS
CREATE OR REPLACE FUNCTION public.is_company_admin(target_company_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_id = target_company_id
    AND user_id = auth.uid()
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql;

-- Policies for companies
DROP POLICY IF EXISTS "Admins can manage companies" ON public.companies;
CREATE POLICY "Admins can manage companies" ON public.companies FOR ALL USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Owner can manage own company" ON public.companies;
CREATE POLICY "Owner can manage own company" ON public.companies FOR ALL USING (auth.uid() = owner_user_id);

DROP POLICY IF EXISTS "Companies are viewable by everyone" ON public.companies;
CREATE POLICY "Companies are viewable by everyone" ON public.companies FOR SELECT USING (true);

-- Policies for company_members
DROP POLICY IF EXISTS "Company admins can insert members" ON public.company_members;
CREATE POLICY "Company admins can insert members" ON public.company_members FOR INSERT
  WITH CHECK (public.is_company_admin(company_id));

DROP POLICY IF EXISTS "Employers can manage their team" ON public.company_members;
CREATE POLICY "Employers can manage their team" ON public.company_members FOR ALL
  USING (auth.uid() = user_id OR public.is_company_admin(company_id));

DROP POLICY IF EXISTS "Company members are viewable by everyone" ON public.company_members;
CREATE POLICY "Company members are viewable by everyone" ON public.company_members FOR SELECT USING (true);

-- Policies for cv_requests
DROP POLICY IF EXISTS "Employers can send cv requests" ON public.cv_requests;
CREATE POLICY "Employers can send cv requests" ON public.cv_requests FOR INSERT WITH CHECK (auth.uid() = employer_id);

DROP POLICY IF EXISTS "Employers view sent CV requests" ON public.cv_requests;
CREATE POLICY "Employers view sent CV requests" ON public.cv_requests FOR SELECT USING (auth.uid() = employer_id);

DROP POLICY IF EXISTS "Candidates view own CV requests" ON public.cv_requests;
CREATE POLICY "Candidates view own CV requests" ON public.cv_requests FOR SELECT USING (auth.uid() = candidate_id);

DROP POLICY IF EXISTS "Candidates update own CV requests" ON public.cv_requests;
CREATE POLICY "Candidates update own CV requests" ON public.cv_requests FOR UPDATE USING (auth.uid() = candidate_id);

-- Policies for highlighted_candidates
DROP POLICY IF EXISTS "Employers manage own highlights" ON public.highlighted_candidates;
CREATE POLICY "Employers manage own highlights" ON public.highlighted_candidates FOR ALL USING (auth.uid() = employer_id);

-- Update jobs/applications policies for employers
DROP POLICY IF EXISTS "Employers can view applications for own jobs" ON public.applications;
CREATE POLICY "Employers can view applications for own jobs" ON public.applications FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.jobs WHERE jobs.id = applications.job_id AND jobs.posted_by = auth.uid()));

DROP POLICY IF EXISTS "Employers can update applications for own jobs" ON public.applications;
CREATE POLICY "Employers can update applications for own jobs" ON public.applications FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.jobs WHERE jobs.id = applications.job_id AND jobs.posted_by = auth.uid()));

DROP POLICY IF EXISTS "Employers can view job_views" ON public.job_views;
CREATE POLICY "Employers can view job_views" ON public.job_views FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.jobs WHERE jobs.id = job_views.job_id AND jobs.posted_by = auth.uid()));

-- Storage Bucket for Company Logos
INSERT INTO storage.buckets (id, name, public) VALUES ('company-logos', 'company-logos', true) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public can read company logos" ON storage.objects;
CREATE POLICY "Public can read company logos" ON storage.objects FOR SELECT USING (bucket_id = 'company-logos');

DROP POLICY IF EXISTS "Authenticated can upload company logos" ON storage.objects;
CREATE POLICY "Authenticated can upload company logos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'company-logos' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated can update company logos" ON storage.objects;
CREATE POLICY "Authenticated can update company logos" ON storage.objects FOR UPDATE USING (bucket_id = 'company-logos' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated can delete company logos" ON storage.objects;
CREATE POLICY "Authenticated can delete company logos" ON storage.objects FOR DELETE USING (bucket_id = 'company-logos' AND auth.role() = 'authenticated');
