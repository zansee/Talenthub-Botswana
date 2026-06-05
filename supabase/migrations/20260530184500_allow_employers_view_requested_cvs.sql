-- Allow employers to read candidate CVs if the candidate approved their CV request
DROP POLICY IF EXISTS "Employers view approved requested CVs" ON storage.objects;
CREATE POLICY "Employers view approved requested CVs" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'cvs' AND
    EXISTS (
      SELECT 1 FROM public.cv_requests r
      WHERE r.candidate_id::text = (storage.foldername(name))[1]
      AND r.employer_id = auth.uid()
      AND r.status = 'sent'
    )
  );
