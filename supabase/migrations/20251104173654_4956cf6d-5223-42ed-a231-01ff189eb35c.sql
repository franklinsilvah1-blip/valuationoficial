-- Add investor profile fields to profiles table (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'last_reclassification_at'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN last_reclassification_at TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- Create table for profile questions
CREATE TABLE IF NOT EXISTS public.profile_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text TEXT NOT NULL,
  order_num INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT 'single_choice',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create table for profile options (answers)
CREATE TABLE IF NOT EXISTS public.profile_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.profile_questions(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  weight_start INTEGER NOT NULL DEFAULT 0,
  weight_pro INTEGER NOT NULL DEFAULT 0,
  weight_specialist INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create table for user answers
CREATE TABLE IF NOT EXISTS public.profile_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.profile_questions(id) ON DELETE CASCADE,
  option_id UUID NOT NULL REFERENCES public.profile_options(id) ON DELETE CASCADE,
  cycle INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on new tables
ALTER TABLE public.profile_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_answers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can view questions" ON public.profile_questions;
DROP POLICY IF EXISTS "Admins can manage questions" ON public.profile_questions;
DROP POLICY IF EXISTS "Anyone can view options" ON public.profile_options;
DROP POLICY IF EXISTS "Admins can manage options" ON public.profile_options;
DROP POLICY IF EXISTS "Users can view own answers" ON public.profile_answers;
DROP POLICY IF EXISTS "Users can insert own answers" ON public.profile_answers;
DROP POLICY IF EXISTS "Admins can view all answers" ON public.profile_answers;
DROP POLICY IF EXISTS "Require authentication for profile_answers" ON public.profile_answers;

-- RLS policies for profile_questions (public read, admin write)
CREATE POLICY "Anyone can view questions"
ON public.profile_questions FOR SELECT
USING (true);

CREATE POLICY "Admins can manage questions"
ON public.profile_questions FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- RLS policies for profile_options (public read, admin write)
CREATE POLICY "Anyone can view options"
ON public.profile_options FOR SELECT
USING (true);

CREATE POLICY "Admins can manage options"
ON public.profile_options FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- RLS policies for profile_answers (users can manage their own)
CREATE POLICY "Users can view own answers"
ON public.profile_answers FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own answers"
ON public.profile_answers FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all answers"
ON public.profile_answers FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Require authentication for profile_answers"
ON public.profile_answers FOR ALL
USING (auth.uid() IS NOT NULL);

-- Insert the 3 questions (only if table is empty)
INSERT INTO public.profile_questions (text, order_num)
SELECT * FROM (VALUES
  ('Qual seu nível de conhecimento sobre investimentos?', 1),
  ('Qual seu objetivo para investir agora?', 2),
  ('Qual o valor que pretende investir?', 3)
) AS v(text, order_num)
WHERE NOT EXISTS (SELECT 1 FROM public.profile_questions LIMIT 1);

-- Insert options for the questions
DO $$
DECLARE
  q1_id UUID;
  q2_id UUID;
  q3_id UUID;
BEGIN
  -- Only proceed if options don't exist yet
  IF NOT EXISTS (SELECT 1 FROM public.profile_options LIMIT 1) THEN
    -- Get question IDs
    SELECT id INTO q1_id FROM public.profile_questions WHERE order_num = 1;
    SELECT id INTO q2_id FROM public.profile_questions WHERE order_num = 2;
    SELECT id INTO q3_id FROM public.profile_questions WHERE order_num = 3;

    -- Insert options for question 1 (knowledge level)
    INSERT INTO public.profile_options (question_id, text, weight_start, weight_pro, weight_specialist) VALUES
    (q1_id, 'Só invisto em renda fixa (poupança, CDB, LCI, CRI, etc.)', 1, 0, 0),
    (q1_id, 'Invisto em renda fixa com isenção de imposto de renda', 1, 0, 0),
    (q1_id, 'Invisto em fundos imobiliários e em algumas ações ou criptos', 0, 1, 0),
    (q1_id, 'Invisto em ações, FIIs, BDRs, ETFs e criptomoedas', 0, 0, 1);

    -- Insert options for question 2 (investment goal)
    INSERT INTO public.profile_options (question_id, text, weight_start, weight_pro, weight_specialist) VALUES
    (q2_id, 'Realizar um sonho imediato (viagens, comprar um bem, etc.)', 1, 0, 0),
    (q2_id, 'Gerar renda extra', 1, 0, 0),
    (q2_id, 'Construir reserva financeira e patrimônio', 0, 1, 0),
    (q2_id, 'Multiplicar patrimônio e independência financeira', 0, 0, 1);

    -- Insert options for question 3 (investment amount)
    INSERT INTO public.profile_options (question_id, text, weight_start, weight_pro, weight_specialist) VALUES
    (q3_id, 'De R$ 1.000 a R$ 9.999', 1, 0, 0),
    (q3_id, 'De R$ 10.000 a R$ 49.999', 0, 1, 0),
    (q3_id, 'De R$ 50.000 a R$ 99.999', 0, 0, 1),
    (q3_id, 'Acima de R$ 100.000,00', 0, 0, 1);
  END IF;
END $$;