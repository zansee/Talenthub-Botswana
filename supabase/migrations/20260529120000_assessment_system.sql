-- Safe alteration of application_status enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'public.application_status'::regtype AND enumlabel = 'assessment_sent') THEN
    ALTER TYPE public.application_status ADD VALUE 'assessment_sent';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'public.application_status'::regtype AND enumlabel = 'offer') THEN
    ALTER TYPE public.application_status ADD VALUE 'offer';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'public.application_status'::regtype AND enumlabel = 'rejected') THEN
    ALTER TYPE public.application_status ADD VALUE 'rejected';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 1. Create External Applications Table
CREATE TABLE IF NOT EXISTS public.external_applications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id uuid REFERENCES public.jobs(id) ON DELETE CASCADE NOT NULL,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  cover_letter text,
  cv_path text NOT NULL,
  cv_filename text NOT NULL,
  status text NOT NULL DEFAULT 'submitted',
  starred boolean DEFAULT false,
  recruiter_notes text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.external_applications ENABLE ROW LEVEL SECURITY;

-- 2. Create Pre-Screening Questions Table
CREATE TABLE IF NOT EXISTS public.pre_screening_questions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id uuid REFERENCES public.jobs(id) ON DELETE CASCADE NOT NULL,
  question_text text NOT NULL,
  question_type text NOT NULL, -- 'multiple_choice', 'yes_no', 'rating', 'short_text', 'long_text'
  options text[],
  is_required boolean DEFAULT false,
  is_disqualifying boolean DEFAULT false,
  correct_answer text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.pre_screening_questions ENABLE ROW LEVEL SECURITY;

-- 3. Create Pre-Screening Answers Table
CREATE TABLE IF NOT EXISTS public.pre_screening_answers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id uuid REFERENCES public.jobs(id) ON DELETE CASCADE NOT NULL,
  application_id uuid REFERENCES public.applications(id) ON DELETE CASCADE,
  external_application_id uuid REFERENCES public.external_applications(id) ON DELETE CASCADE,
  question_id uuid REFERENCES public.pre_screening_questions(id) ON DELETE CASCADE NOT NULL,
  answer_text text NOT NULL,
  is_disqualified boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT one_app_ref CHECK (
    (application_id IS NOT NULL AND external_application_id IS NULL) OR
    (application_id IS NULL AND external_application_id IS NOT NULL)
  )
);
ALTER TABLE public.pre_screening_answers ENABLE ROW LEVEL SECURITY;

-- 4. Create Assessments Table
CREATE TABLE IF NOT EXISTS public.assessments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id uuid REFERENCES public.jobs(id) ON DELETE CASCADE NOT NULL UNIQUE,
  name text NOT NULL,
  attempts_allowed text DEFAULT '1' NOT NULL, -- '1', '2', 'unlimited'
  is_live_timed boolean DEFAULT false NOT NULL,
  deadline_days int,
  auto_send boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;

-- 5. Create Assessment Questions Table
CREATE TABLE IF NOT EXISTS public.assessment_questions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id uuid REFERENCES public.assessments(id) ON DELETE CASCADE NOT NULL,
  question_text text NOT NULL,
  question_type text NOT NULL, -- 'text', 'video', 'multiple_choice', 'iq_aptitude'
  order_index int DEFAULT 0 NOT NULL,
  options text[],
  correct_answers text[],
  video_max_duration int DEFAULT 60,
  iq_difficulty text, -- 'entry', 'mid', 'senior'
  iq_count int, -- 10, 20, 30
  iq_source text, -- 'bank', 'ai', 'mixed'
  time_limit_seconds int,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.assessment_questions ENABLE ROW LEVEL SECURITY;

-- 6. Create Assessment Responses Table
CREATE TABLE IF NOT EXISTS public.assessment_responses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id uuid REFERENCES public.assessments(id) ON DELETE CASCADE NOT NULL,
  application_id uuid REFERENCES public.applications(id) ON DELETE CASCADE,
  external_application_id uuid REFERENCES public.external_applications(id) ON DELETE CASCADE,
  attempt_number int DEFAULT 1 NOT NULL,
  answers jsonb DEFAULT '{}'::jsonb NOT NULL,
  score numeric,
  completed_at timestamp with time zone,
  time_taken_seconds int,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT one_app_ref_resp CHECK (
    (application_id IS NOT NULL AND external_application_id IS NULL) OR
    (application_id IS NULL AND external_application_id IS NOT NULL)
  )
);
ALTER TABLE public.assessment_responses ENABLE ROW LEVEL SECURITY;

-- 7. Create IQ Question Bank Table
CREATE TABLE IF NOT EXISTS public.iq_question_bank (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  category text NOT NULL, -- 'logical', 'numerical', 'verbal'
  question_text text NOT NULL,
  options text[] NOT NULL,
  correct_option_index int NOT NULL,
  time_limit_seconds int DEFAULT 60 NOT NULL,
  difficulty text NOT NULL, -- 'entry', 'mid', 'senior'
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.iq_question_bank ENABLE ROW LEVEL SECURITY;

-- 8. Create Video Notes Table
CREATE TABLE IF NOT EXISTS public.video_notes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  response_id uuid REFERENCES public.assessment_responses(id) ON DELETE CASCADE NOT NULL,
  question_id uuid REFERENCES public.assessment_questions(id) ON DELETE CASCADE NOT NULL,
  timestamp numeric NOT NULL,
  note text NOT NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.video_notes ENABLE ROW LEVEL SECURITY;

-- 9. Create Assessment Tokens Table
CREATE TABLE IF NOT EXISTS public.assessment_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  assessment_id uuid REFERENCES public.assessments(id) ON DELETE CASCADE NOT NULL,
  application_id uuid REFERENCES public.applications(id) ON DELETE CASCADE,
  external_application_id uuid REFERENCES public.external_applications(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL,
  attempt_number int DEFAULT 1 NOT NULL,
  used_at timestamp with time zone,
  expires_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT one_app_ref_tok CHECK (
    (application_id IS NOT NULL AND external_application_id IS NULL) OR
    (application_id IS NULL AND external_application_id IS NOT NULL)
  )
);
ALTER TABLE public.assessment_tokens ENABLE ROW LEVEL SECURITY;


-- ==================== RLS Policies ====================

-- external_applications policies
DROP POLICY IF EXISTS "Public can insert external applications" ON public.external_applications;
CREATE POLICY "Public can insert external applications" ON public.external_applications
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Employers can view external applications" ON public.external_applications;
CREATE POLICY "Employers can view external applications" ON public.external_applications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.jobs j
      LEFT JOIN public.company_members cm ON j.company_id = cm.company_id
      WHERE j.id = external_applications.job_id
      AND (j.posted_by = auth.uid() OR cm.user_id = auth.uid())
    )
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "Employers can update external applications" ON public.external_applications;
CREATE POLICY "Employers can update external applications" ON public.external_applications
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.jobs j
      LEFT JOIN public.company_members cm ON j.company_id = cm.company_id
      WHERE j.id = external_applications.job_id
      AND (j.posted_by = auth.uid() OR cm.user_id = auth.uid())
    )
    OR public.has_role(auth.uid(), 'admin')
  );

-- pre_screening_questions policies
DROP POLICY IF EXISTS "Anyone can view pre-screening questions" ON public.pre_screening_questions;
CREATE POLICY "Anyone can view pre-screening questions" ON public.pre_screening_questions
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Employers can manage pre-screening questions" ON public.pre_screening_questions;
CREATE POLICY "Employers can manage pre-screening questions" ON public.pre_screening_questions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.jobs j
      LEFT JOIN public.company_members cm ON j.company_id = cm.company_id
      WHERE j.id = pre_screening_questions.job_id
      AND (j.posted_by = auth.uid() OR cm.user_id = auth.uid())
    )
    OR public.has_role(auth.uid(), 'admin')
  );

-- pre_screening_answers policies
DROP POLICY IF EXISTS "Anyone can insert pre-screening answers" ON public.pre_screening_answers;
CREATE POLICY "Anyone can insert pre-screening answers" ON public.pre_screening_answers
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Employers can view pre-screening answers" ON public.pre_screening_answers;
CREATE POLICY "Employers can view pre-screening answers" ON public.pre_screening_answers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.jobs j
      LEFT JOIN public.company_members cm ON j.company_id = cm.company_id
      WHERE j.id = pre_screening_answers.job_id
      AND (j.posted_by = auth.uid() OR cm.user_id = auth.uid())
    )
    OR public.has_role(auth.uid(), 'admin')
  );

-- assessments policies
DROP POLICY IF EXISTS "Anyone can view assessments" ON public.assessments;
CREATE POLICY "Anyone can view assessments" ON public.assessments
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Employers can manage assessments" ON public.assessments;
CREATE POLICY "Employers can manage assessments" ON public.assessments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.jobs j
      LEFT JOIN public.company_members cm ON j.company_id = cm.company_id
      WHERE j.id = assessments.job_id
      AND (j.posted_by = auth.uid() OR cm.user_id = auth.uid())
    )
    OR public.has_role(auth.uid(), 'admin')
  );

-- assessment_questions policies
DROP POLICY IF EXISTS "Anyone can view assessment questions" ON public.assessment_questions;
CREATE POLICY "Anyone can view assessment questions" ON public.assessment_questions
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Employers can manage assessment questions" ON public.assessment_questions;
CREATE POLICY "Employers can manage assessment questions" ON public.assessment_questions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.assessments a
      JOIN public.jobs j ON a.job_id = j.id
      LEFT JOIN public.company_members cm ON j.company_id = cm.company_id
      WHERE a.id = assessment_questions.assessment_id
      AND (j.posted_by = auth.uid() OR cm.user_id = auth.uid())
    )
    OR public.has_role(auth.uid(), 'admin')
  );

-- assessment_responses policies
DROP POLICY IF EXISTS "Anyone can insert/update assessment responses" ON public.assessment_responses;
CREATE POLICY "Anyone can insert/update assessment responses" ON public.assessment_responses
  FOR ALL USING (true);

DROP POLICY IF EXISTS "Employers can view assessment responses" ON public.assessment_responses;
CREATE POLICY "Employers can view assessment responses" ON public.assessment_responses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.assessments a
      JOIN public.jobs j ON a.job_id = j.id
      LEFT JOIN public.company_members cm ON j.company_id = cm.company_id
      WHERE a.id = assessment_responses.assessment_id
      AND (j.posted_by = auth.uid() OR cm.user_id = auth.uid())
    )
    OR public.has_role(auth.uid(), 'admin')
  );

-- iq_question_bank policies
DROP POLICY IF EXISTS "Anyone can view IQ questions" ON public.iq_question_bank;
CREATE POLICY "Anyone can view IQ questions" ON public.iq_question_bank
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage IQ questions" ON public.iq_question_bank;
CREATE POLICY "Admins can manage IQ questions" ON public.iq_question_bank
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- video_notes policies
DROP POLICY IF EXISTS "Employers can manage video notes" ON public.video_notes;
CREATE POLICY "Employers can manage video notes" ON public.video_notes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.assessment_responses r
      JOIN public.assessments a ON r.assessment_id = a.id
      JOIN public.jobs j ON a.job_id = j.id
      LEFT JOIN public.company_members cm ON j.company_id = cm.company_id
      WHERE r.id = video_notes.response_id
      AND (j.posted_by = auth.uid() OR cm.user_id = auth.uid())
    )
    OR public.has_role(auth.uid(), 'admin')
  );

-- assessment_tokens policies
DROP POLICY IF EXISTS "Anyone can view assessment tokens" ON public.assessment_tokens;
CREATE POLICY "Anyone can view assessment tokens" ON public.assessment_tokens
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can update assessment tokens" ON public.assessment_tokens;
CREATE POLICY "Anyone can update assessment tokens" ON public.assessment_tokens
  FOR UPDATE USING (true);


-- ==================== Storage Buckets & Policies ====================

INSERT INTO storage.buckets (id, name, public) VALUES ('assessment-videos', 'assessment-videos', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('external-cvs', 'external-cvs', true) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public can upload CVs" ON storage.objects;
CREATE POLICY "Public can upload CVs" ON storage.objects
  FOR INSERT TO public WITH CHECK (bucket_id = 'external-cvs');

DROP POLICY IF EXISTS "Public can upload assessment videos" ON storage.objects;
CREATE POLICY "Public can upload assessment videos" ON storage.objects
  FOR INSERT TO public WITH CHECK (bucket_id = 'assessment-videos');

DROP POLICY IF EXISTS "Anyone can view assessment videos" ON storage.objects;
CREATE POLICY "Anyone can view assessment videos" ON storage.objects
  FOR SELECT USING (bucket_id = 'assessment-videos');

DROP POLICY IF EXISTS "Employers can view external CVs" ON storage.objects;
CREATE POLICY "Employers can view external CVs" ON storage.objects
  FOR SELECT USING (bucket_id = 'external-cvs');


-- ==================== Seeding Sample IQ Questions ====================

INSERT INTO public.iq_question_bank (category, question_text, options, correct_option_index, time_limit_seconds, difficulty)
VALUES
  ('logical', 'Which number should come next in the pattern: 37, 34, 31, 28, ?', ARRAY['25', '26', '24', '22'], 0, 45, 'entry'),
  ('logical', 'All bats are mammals. Some mammals fly. Therefore, do all bats fly?', ARRAY['Yes, logically', 'No, not logically', 'Insufficient information', 'None of the above'], 1, 45, 'mid'),
  ('numerical', 'If 5 machines take 5 minutes to make 5 widgets, how long would it take 100 machines to make 100 widgets?', ARRAY['100 minutes', '50 minutes', '5 minutes', '25 minutes'], 2, 60, 'mid'),
  ('numerical', 'Solve: 12% of 150 = ?', ARRAY['15', '18', '20', '22'], 1, 30, 'entry'),
  ('verbal', 'Select the synonym for "EPHEMERAL":', ARRAY['Eternal', 'Short-lived', 'Beautiful', 'Mysterious'], 1, 30, 'mid'),
  ('verbal', 'Choose the word that best fits the sentence: The candidate demonstrated an ______ grasp of the complex market regulations.', ARRAY['astute', 'apathy', 'archaic', 'artificial'], 0, 30, 'mid'),
  ('logical', 'Find the odd one out:', ARRAY['Copper', 'Iron', 'Bronze', 'Gold'], 2, 45, 'entry'), -- Bronze is an alloy, others are elements
  ('numerical', 'A train traveling at 60 km/h passes a post in 9 seconds. What is the length of the train in meters?', ARRAY['120m', '150m', '180m', '200m'], 1, 60, 'senior'),
  ('verbal', '"OBSEQUIOUS" is closest in meaning to:', ARRAY['Servile', 'Rebellious', 'Honest', 'Domineering'], 0, 30, 'senior')
ON CONFLICT DO NOTHING;
