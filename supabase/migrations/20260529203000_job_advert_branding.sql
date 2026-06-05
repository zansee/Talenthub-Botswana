-- Migration: Corporate Brand Settings
-- Timestamp: 20260529203000

-- 1. Add corporate branding columns to public.companies
ALTER TABLE public.companies 
  ADD COLUMN IF NOT EXISTS brand_primary_color TEXT DEFAULT '#22C55E',
  ADD COLUMN IF NOT EXISTS brand_secondary_color TEXT DEFAULT '#0D1117',
  ADD COLUMN IF NOT EXISTS brand_accent_color TEXT DEFAULT '#3B82F6',
  ADD COLUMN IF NOT EXISTS brand_style_recipe JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS brand_sample_post_path TEXT;

-- 2. Update update/delete policies for public.companies to allow company admins
DROP POLICY IF EXISTS "Company admins can manage company" ON public.companies;
CREATE POLICY "Company admins can manage company" ON public.companies 
  FOR UPDATE TO authenticated
  USING (
    public.is_company_admin(id) 
    OR auth.uid() = owner_user_id
  );

-- 3. Setup Brand Samples Storage Bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('brand-samples', 'brand-samples', true) 
ON CONFLICT (id) DO NOTHING;

-- 4. Storage policies for brand-samples bucket
DROP POLICY IF EXISTS "Public can read brand samples" ON storage.objects;
CREATE POLICY "Public can read brand samples" ON storage.objects 
  FOR SELECT USING (bucket_id = 'brand-samples');

DROP POLICY IF EXISTS "Authenticated can upload brand samples" ON storage.objects;
CREATE POLICY "Authenticated can upload brand samples" ON storage.objects 
  FOR INSERT WITH CHECK (bucket_id = 'brand-samples' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated can update brand samples" ON storage.objects;
CREATE POLICY "Authenticated can update brand samples" ON storage.objects 
  FOR UPDATE USING (bucket_id = 'brand-samples' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated can delete brand samples" ON storage.objects;
CREATE POLICY "Authenticated can delete brand samples" ON storage.objects 
  FOR DELETE USING (bucket_id = 'brand-samples' AND auth.role() = 'authenticated');
