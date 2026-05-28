-- 1. Add required_documents array to jobs table
ALTER TABLE public.jobs 
  ADD COLUMN IF NOT EXISTS required_documents TEXT[] DEFAULT '{}';

-- 2. Add merged_pdf_path to applications table
ALTER TABLE public.applications 
  ADD COLUMN IF NOT EXISTS merged_pdf_path TEXT;

-- 3. Ensure the 'application-docs' storage bucket exists and is public
INSERT INTO storage.buckets (id, name, public) 
  VALUES ('application-docs', 'application-docs', true)
  ON CONFLICT (id) DO UPDATE SET public = true;

-- 4. Drop existing storage policies for application-docs
DROP POLICY IF EXISTS "Allow authenticated uploads to application-docs" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read from application-docs" ON storage.objects;

-- 5. Create storage policies
CREATE POLICY "Allow authenticated uploads to application-docs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'application-docs');

CREATE POLICY "Allow public read from application-docs"
  ON storage.objects FOR SELECT USING (bucket_id = 'application-docs');
