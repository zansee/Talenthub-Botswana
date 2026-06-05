-- 1. Create storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('revamp-documents', 'revamp-documents', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('delivered-cvs', 'delivered-cvs', false) ON CONFLICT (id) DO NOTHING;

-- 2. Storage Policies for revamp-documents
CREATE POLICY "Users upload own revamp-documents" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'revamp-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users read own revamp-documents" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'revamp-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own revamp-documents" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'revamp-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins read all revamp-documents" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'revamp-documents' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins write all revamp-documents" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'revamp-documents' AND public.has_role(auth.uid(), 'admin'));

-- 3. Storage Policies for delivered-cvs
CREATE POLICY "Users read own delivered-cvs" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'delivered-cvs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins read all delivered-cvs" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'delivered-cvs' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins write all delivered-cvs" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'delivered-cvs' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update all delivered-cvs" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'delivered-cvs' AND public.has_role(auth.uid(), 'admin'));

-- 4. Create cv_versions table
CREATE TABLE IF NOT EXISTS public.cv_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  filename text NOT NULL,
  label text NOT NULL,
  is_main boolean NOT NULL DEFAULT false,
  ai_score integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS for cv_versions
ALTER TABLE public.cv_versions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for cv_versions
CREATE POLICY "Users view own CV versions" ON public.cv_versions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users update own CV versions" ON public.cv_versions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users delete own CV versions" ON public.cv_versions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users insert own CV versions" ON public.cv_versions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage all CV versions" ON public.cv_versions
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 5. Add columns to revamp_requests
ALTER TABLE public.revamp_requests ADD COLUMN IF NOT EXISTS ai_rewritten_cv text;
ALTER TABLE public.revamp_requests ADD COLUMN IF NOT EXISTS ai_consensus_score integer;
ALTER TABLE public.revamp_requests ADD COLUMN IF NOT EXISTS ai_debate_report jsonb;
ALTER TABLE public.revamp_requests ADD COLUMN IF NOT EXISTS rounds_needed integer;
ALTER TABLE public.revamp_requests ADD COLUMN IF NOT EXISTS ai_debate_step integer DEFAULT 0;
ALTER TABLE public.revamp_requests ADD COLUMN IF NOT EXISTS additional_attachment_paths text[] DEFAULT '{}';

-- 6. Trigger to notify edge function when revamp is 'assigned'
CREATE OR REPLACE FUNCTION public.trigger_cv_revamp_process()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Trigger Edge Function call asynchronously when status changes to 'assigned'
  IF NEW.fulfilment_status = 'assigned' AND (OLD IS NULL OR OLD.fulfilment_status IS DISTINCT FROM 'assigned') THEN
    PERFORM net.http_post(
      url := 'https://hovxyfqpinwqomvevrfb.supabase.co/functions/v1/process-cv-revamp'::text,
      body := jsonb_build_object('record', row_to_json(NEW))::jsonb,
      headers := '{"Content-Type": "application/json"}'::jsonb,
      timeout_milliseconds := 5000
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_trigger_cv_revamp_process ON public.revamp_requests;
CREATE TRIGGER trg_trigger_cv_revamp_process
AFTER UPDATE ON public.revamp_requests
FOR EACH ROW
EXECUTE FUNCTION public.trigger_cv_revamp_process();
