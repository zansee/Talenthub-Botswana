-- 1. Grant execute on has_role function to authenticated users so they can run RLS policies using it
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;

-- 2. Drop existing SELECT policies on job_views table
DROP POLICY IF EXISTS "Users see own job views" ON public.job_views;
DROP POLICY IF EXISTS "Admins see all job views" ON public.job_views;
DROP POLICY IF EXISTS "Employers see views of own jobs" ON public.job_views;

-- 3. Create updated candidate select policy
CREATE POLICY "Users see own job views" ON public.job_views
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 4. Create updated admin select policy (direct check to avoid function permission issues)
CREATE POLICY "Admins see all job views" ON public.job_views
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'::public.app_role
    )
  );

-- 5. Create new employer/recruiter select policy to view job views of their own company's jobs
CREATE POLICY "Employers see views of own jobs" ON public.job_views
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs
      WHERE jobs.id = job_views.job_id
      AND (
        jobs.posted_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.company_members
          WHERE company_members.company_id = jobs.company_id
          AND company_members.user_id = auth.uid()
        )
      )
    )
  );
