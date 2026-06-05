-- Add job_id to public.interview_preps
ALTER TABLE public.interview_preps ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL;

-- Add status to public.jobs
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'approved';

-- Recreate SELECT policy on public.jobs
DROP POLICY IF EXISTS "Authenticated view active jobs" ON public.jobs;
CREATE POLICY "Authenticated view active jobs" ON public.jobs FOR SELECT TO authenticated
  USING (
    is_active = TRUE OR
    public.has_role(auth.uid(), 'admin') OR
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = jobs.company_id
      AND cm.user_id = auth.uid()
    ) OR
    posted_by = auth.uid()
  );

-- Recreate INSERT policy on public.jobs to allow recruiters
DROP POLICY IF EXISTS "Employers can insert jobs" ON public.jobs;
CREATE POLICY "Employers can insert jobs" ON public.jobs FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = posted_by AND (
      EXISTS (
        SELECT 1 FROM public.company_members
        WHERE company_members.company_id = jobs.company_id
        AND company_members.user_id = auth.uid()
        AND company_members.role IN ('admin', 'hiring_manager', 'recruiter')
      )
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.account_type IN ('employer', 'job_poster')
      )
    )
  );

-- Recreate UPDATE policy on public.jobs to allow recruiters
DROP POLICY IF EXISTS "Employers can update own jobs" ON public.jobs;
CREATE POLICY "Employers can update own jobs" ON public.jobs FOR UPDATE TO authenticated
  USING (
    auth.uid() = posted_by AND (
      EXISTS (
        SELECT 1 FROM public.company_members
        WHERE company_members.company_id = jobs.company_id
        AND company_members.user_id = auth.uid()
        AND company_members.role IN ('admin', 'hiring_manager', 'recruiter')
      )
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.account_type IN ('employer', 'job_poster')
      )
    )
  );

-- Recreate DELETE policy on public.jobs to allow recruiters
DROP POLICY IF EXISTS "Employers can delete own jobs" ON public.jobs;
CREATE POLICY "Employers can delete own jobs" ON public.jobs FOR DELETE TO authenticated
  USING (
    auth.uid() = posted_by AND (
      EXISTS (
        SELECT 1 FROM public.company_members
        WHERE company_members.company_id = jobs.company_id
        AND company_members.user_id = auth.uid()
        AND company_members.role IN ('admin', 'hiring_manager', 'recruiter')
      )
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.account_type IN ('employer', 'job_poster')
      )
    )
  );

-- Recreate public.applications SELECT and UPDATE policies
DROP POLICY IF EXISTS "Employers can view applications for own jobs" ON public.applications;
DROP POLICY IF EXISTS "Company members can view applications" ON public.applications;
CREATE POLICY "Company members can view applications" ON public.applications FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id OR
    public.has_role(auth.uid(), 'admin') OR
    EXISTS (
      SELECT 1 FROM public.jobs j
      JOIN public.company_members cm ON j.company_id = cm.company_id
      WHERE j.id = applications.job_id
      AND cm.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = applications.job_id
      AND j.posted_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Employers can update applications for own jobs" ON public.applications;
DROP POLICY IF EXISTS "Company members can update applications" ON public.applications;
CREATE POLICY "Company members can update applications" ON public.applications FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    EXISTS (
      SELECT 1 FROM public.jobs j
      JOIN public.company_members cm ON j.company_id = cm.company_id
      WHERE j.id = applications.job_id
      AND cm.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = applications.job_id
      AND j.posted_by = auth.uid()
    )
  );
