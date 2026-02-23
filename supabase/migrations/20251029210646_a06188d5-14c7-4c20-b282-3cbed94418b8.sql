-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
CREATE TYPE app_role AS ENUM ('user', 'admin');
CREATE TYPE plan_type AS ENUM ('FREE', 'START', 'PRO', 'SPECIALIST');
CREATE TYPE investor_profile AS ENUM ('START', 'PRO', 'SPECIALIST');
CREATE TYPE asset_type AS ENUM ('ACAO', 'FII', 'BDR', 'ETF', 'REIT');
CREATE TYPE recommendation AS ENUM ('COMPRAR', 'MANTER', 'VENDER');
CREATE TYPE trend AS ENUM ('ALTA', 'NEUTRO', 'BAIXA');
CREATE TYPE import_type AS ENUM ('FREE', 'PREMIUM');
CREATE TYPE import_status AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED');

-- Profiles table (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  plan plan_type NOT NULL DEFAULT 'FREE',
  investor_profile investor_profile,
  plan_start_at TIMESTAMP WITH TIME ZONE,
  plan_end_at TIMESTAMP WITH TIME ZONE,
  last_reclassification_at TIMESTAMP WITH TIME ZONE,
  stripe_customer_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- User roles table (for admin access)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Assets table (Brazilian market assets)
CREATE TABLE public.assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_b3 TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  tipo asset_type NOT NULL,
  setor TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Asset analyses table (analysis per portfolio tier)
CREATE TABLE public.asset_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES public.assets(id) ON DELETE CASCADE NOT NULL,
  carteira plan_type NOT NULL,
  recomendacao recommendation,
  tendencia trend,
  nota_especialista INTEGER CHECK (nota_especialista >= 0 AND nota_especialista <= 10),
  resumo TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(asset_id, carteira)
);

-- Profile questions table (onboarding questions)
CREATE TABLE public.profile_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_num INTEGER NOT NULL UNIQUE,
  text TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'single_choice',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Profile options table (answer options for questions)
CREATE TABLE public.profile_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID REFERENCES public.profile_questions(id) ON DELETE CASCADE NOT NULL,
  text TEXT NOT NULL,
  weight_start INTEGER NOT NULL DEFAULT 0,
  weight_pro INTEGER NOT NULL DEFAULT 0,
  weight_specialist INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Profile answers table (user responses to onboarding)
CREATE TABLE public.profile_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  question_id UUID REFERENCES public.profile_questions(id) ON DELETE CASCADE NOT NULL,
  option_id UUID REFERENCES public.profile_options(id) ON DELETE CASCADE NOT NULL,
  cycle INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, question_id, cycle)
);

-- Import jobs table (CSV import history)
CREATE TABLE public.import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type import_type NOT NULL,
  filename TEXT NOT NULL,
  status import_status NOT NULL DEFAULT 'PENDING',
  inserted INTEGER DEFAULT 0,
  updated INTEGER DEFAULT 0,
  failed INTEGER DEFAULT 0,
  error_log JSONB,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Security definer function to check user role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS Policies for user_roles
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for assets (public read for FREE tier)
CREATE POLICY "Anyone can view assets"
  ON public.assets FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Admins can insert assets"
  ON public.assets FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update assets"
  ON public.assets FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete assets"
  ON public.assets FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for asset_analyses (restricted by plan)
CREATE POLICY "Authenticated users can view analyses matching their plan"
  ON public.asset_analyses FOR SELECT
  TO authenticated
  USING (
    carteira = 'START' OR
    (carteira = 'PRO' AND EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND plan IN ('PRO', 'SPECIALIST')
    )) OR
    (carteira = 'SPECIALIST' AND EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND plan = 'SPECIALIST'
    ))
  );

CREATE POLICY "Admins can manage analyses"
  ON public.asset_analyses FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for profile_questions (public read)
CREATE POLICY "Anyone can view questions"
  ON public.profile_questions FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Admins can manage questions"
  ON public.profile_questions FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for profile_options (public read)
CREATE POLICY "Anyone can view options"
  ON public.profile_options FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Admins can manage options"
  ON public.profile_options FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for profile_answers
CREATE POLICY "Users can view own answers"
  ON public.profile_answers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own answers"
  ON public.profile_answers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all answers"
  ON public.profile_answers FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for import_jobs
CREATE POLICY "Admins can view import jobs"
  ON public.import_jobs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create import jobs"
  ON public.import_jobs FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, plan)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    'FREE'
  );
  RETURN NEW;
END;
$$;

-- Trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_assets_updated_at
  BEFORE UPDATE ON public.assets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_asset_analyses_updated_at
  BEFORE UPDATE ON public.asset_analyses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Insert default onboarding questions (pt-BR)
INSERT INTO public.profile_questions (order_num, text, type) VALUES
(1, 'Qual é o seu principal objetivo ao investir?', 'single_choice'),
(2, 'Qual é o seu nível de experiência com investimentos?', 'single_choice'),
(3, 'Quanto você pretende investir mensalmente?', 'single_choice');

-- Insert default options for question 1 (objetivo)
INSERT INTO public.profile_options (question_id, text, weight_start, weight_pro, weight_specialist)
SELECT id, 'Preservar capital e ter segurança', 10, 3, 1 FROM public.profile_questions WHERE order_num = 1
UNION ALL
SELECT id, 'Crescimento moderado com algum risco', 5, 10, 3 FROM public.profile_questions WHERE order_num = 1
UNION ALL
SELECT id, 'Máximo retorno, aceito riscos elevados', 1, 5, 10 FROM public.profile_questions WHERE order_num = 1;

-- Insert default options for question 2 (experiência)
INSERT INTO public.profile_options (question_id, text, weight_start, weight_pro, weight_specialist)
SELECT id, 'Iniciante, estou começando agora', 10, 2, 0 FROM public.profile_questions WHERE order_num = 2
UNION ALL
SELECT id, 'Intermediário, já invisto há algum tempo', 3, 10, 5 FROM public.profile_questions WHERE order_num = 2
UNION ALL
SELECT id, 'Avançado, tenho bastante experiência', 0, 3, 10 FROM public.profile_questions WHERE order_num = 2;

-- Insert default options for question 3 (valor mensal)
INSERT INTO public.profile_options (question_id, text, weight_start, weight_pro, weight_specialist)
SELECT id, 'Até R$ 500', 10, 5, 2 FROM public.profile_questions WHERE order_num = 3
UNION ALL
SELECT id, 'De R$ 500 a R$ 2.000', 5, 10, 5 FROM public.profile_questions WHERE order_num = 3
UNION ALL
SELECT id, 'Acima de R$ 2.000', 2, 5, 10 FROM public.profile_questions WHERE order_num = 3;

-- Create indexes for better performance
CREATE INDEX idx_assets_codigo_b3 ON public.assets(codigo_b3);
CREATE INDEX idx_assets_tipo ON public.assets(tipo);
CREATE INDEX idx_assets_setor ON public.assets(setor);
CREATE INDEX idx_asset_analyses_asset_id ON public.asset_analyses(asset_id);
CREATE INDEX idx_asset_analyses_carteira ON public.asset_analyses(carteira);
CREATE INDEX idx_profile_answers_user_id ON public.profile_answers(user_id);
CREATE INDEX idx_import_jobs_type_status ON public.import_jobs(type, status);