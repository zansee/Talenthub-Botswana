-- Add foreign key constraint to job_views.job_id linking to jobs.id
ALTER TABLE public.job_views 
  ADD CONSTRAINT job_views_job_id_fkey 
  FOREIGN KEY (job_id) 
  REFERENCES public.jobs(id) 
  ON DELETE CASCADE;
