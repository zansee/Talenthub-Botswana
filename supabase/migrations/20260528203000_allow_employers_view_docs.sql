-- 1. Allow employers and company members to select candidate's supporting documents
DROP POLICY IF EXISTS "Employers view applicant documents" ON public.application_documents;
CREATE POLICY "Employers view applicant documents" ON public.application_documents
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.applications a
      JOIN public.jobs j ON a.job_id = j.id
      LEFT JOIN public.company_members cm ON j.company_id = cm.company_id
      WHERE a.user_id = public.application_documents.user_id
      AND (j.posted_by = auth.uid() OR cm.user_id = auth.uid())
    )
    OR public.has_role(auth.uid(), 'admin')
  );

-- 2. Allow employers and company members to read candidate CVs and supporting documents in cvs and app-docs storage buckets
DROP POLICY IF EXISTS "Employers view applicant CVs" ON storage.objects;
CREATE POLICY "Employers view applicant CVs" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    (bucket_id IN ('cvs', 'app-docs')) AND
    (
      EXISTS (
        SELECT 1 FROM public.applications a
        JOIN public.jobs j ON a.job_id = j.id
        LEFT JOIN public.company_members cm ON j.company_id = cm.company_id
        WHERE a.user_id::text = (storage.foldername(name))[1]
        AND (j.posted_by = auth.uid() OR cm.user_id = auth.uid())
      )
      OR public.has_role(auth.uid(), 'admin')
    )
  );
