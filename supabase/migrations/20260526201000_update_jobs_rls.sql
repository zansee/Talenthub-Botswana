-- 1. Enable RLS on jobs table
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing restrictive policies
DROP POLICY IF EXISTS "Admins insert jobs" ON public.jobs;
DROP POLICY IF EXISTS "Admins update jobs" ON public.jobs;
DROP POLICY IF EXISTS "Admins delete jobs" ON public.jobs;
DROP POLICY IF EXISTS "Employers can insert jobs" ON public.jobs;
DROP POLICY IF EXISTS "Employers can update own jobs" ON public.jobs;
DROP POLICY IF EXISTS "Employers can delete own jobs" ON public.jobs;

-- 3. Create platform Admin policies
CREATE POLICY "Admins insert jobs" ON public.jobs FOR INSERT TO authenticated 
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update jobs" ON public.jobs FOR UPDATE TO authenticated 
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete jobs" ON public.jobs FOR DELETE TO authenticated 
  USING (public.has_role(auth.uid(), 'admin'));

-- 4. Create Employer/Company Member policies based on company_members roles ('admin', 'hiring_manager')
CREATE POLICY "Employers can insert jobs" ON public.jobs FOR INSERT TO authenticated 
  WITH CHECK (
    auth.uid() = posted_by AND (
      -- Is a member of the company with admin/hiring_manager roles
      EXISTS (
        SELECT 1 FROM public.company_members 
        WHERE company_members.company_id = jobs.company_id 
        AND company_members.user_id = auth.uid() 
        AND company_members.role IN ('admin', 'hiring_manager')
      )
      -- Or is an employer/job_poster profile (for backwards compatibility)
      OR EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.account_type IN ('employer', 'job_poster')
      )
    )
  );

CREATE POLICY "Employers can update own jobs" ON public.jobs FOR UPDATE TO authenticated 
  USING (
    auth.uid() = posted_by AND (
      EXISTS (
        SELECT 1 FROM public.company_members 
        WHERE company_members.company_id = jobs.company_id 
        AND company_members.user_id = auth.uid() 
        AND company_members.role IN ('admin', 'hiring_manager')
      )
      OR EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.account_type IN ('employer', 'job_poster')
      )
    )
  );

CREATE POLICY "Employers can delete own jobs" ON public.jobs FOR DELETE TO authenticated 
  USING (
    auth.uid() = posted_by AND (
      EXISTS (
        SELECT 1 FROM public.company_members 
        WHERE company_members.company_id = jobs.company_id 
        AND company_members.user_id = auth.uid() 
        AND company_members.role IN ('admin', 'hiring_manager')
      )
      OR EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.account_type IN ('employer', 'job_poster')
      )
    )
  );
