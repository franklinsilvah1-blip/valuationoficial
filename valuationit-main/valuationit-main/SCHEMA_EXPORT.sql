-- ============================================
-- SCHEMA EXPORT COMPLETO - ValuationIT
-- Gerado em: 2026-02-22
-- ============================================

-- ==========================================
-- 1. ENUMS
-- ==========================================

CREATE TYPE public.plan_type AS ENUM ('FREE', 'START', 'PRO', 'SPECIALIST');
CREATE TYPE public.investor_profile AS ENUM ('START', 'PRO', 'SPECIALIST');
CREATE TYPE public.asset_type AS ENUM ('ACAO', 'FII', 'BDR', 'ETF', 'CRIPTO');
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'editor', 'user');
CREATE TYPE public.affiliate_status AS ENUM ('pending', 'active', 'inactive', 'rejected');
CREATE TYPE public.commission_status AS ENUM ('pending', 'approved', 'paid', 'cancelled');
CREATE TYPE public.blog_status AS ENUM ('draft', 'published', 'scheduled', 'archived');
CREATE TYPE public.import_status AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED');
CREATE TYPE public.import_type AS ENUM ('ASSETS', 'ANALYSES', 'FULL');
CREATE TYPE public.operation_type AS ENUM ('COMPRA', 'VENDA', 'PROVENTO', 'APORTE');

-- ==========================================
-- 2. TABELAS BASE (sem dependências)
-- ==========================================

-- profiles
CREATE TABLE public.profiles (
  id uuid NOT NULL PRIMARY KEY,
  name text,
  email text,
  phone text,
  plan plan_type NOT NULL DEFAULT 'FREE',
  investor_profile investor_profile,
  plan_start_at timestamptz,
  plan_end_at timestamptz,
  last_reclassification_at timestamptz,
  stripe_customer_id text,
  hide_community_message boolean DEFAULT false,
  theme_preference text DEFAULT 'light',
  sidebar_collapsed boolean DEFAULT false,
  notifications_enabled boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- user_roles
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- app_config
CREATE TABLE public.app_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  value text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- categories
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- blog_authors
CREATE TABLE public.blog_authors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  avatar_url text,
  bio text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- profile_questions
CREATE TABLE public.profile_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text text NOT NULL,
  order_num integer NOT NULL,
  type text DEFAULT 'single_choice',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- profile_options
CREATE TABLE public.profile_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.profile_questions(id),
  text text NOT NULL,
  weight_start integer NOT NULL DEFAULT 0,
  weight_pro integer NOT NULL DEFAULT 0,
  weight_specialist integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- subscription_plans
CREATE TABLE public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_code text NOT NULL,
  display_name text NOT NULL,
  description text,
  price_quarterly numeric NOT NULL DEFAULT 0,
  price_note text,
  stripe_price_id text,
  features jsonb DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- notification_groups
CREATE TABLE public.notification_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- tracking_scripts
CREATE TABLE public.tracking_scripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL,
  script_id text,
  script_content text,
  location text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- assets
CREATE TABLE public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_b3 text NOT NULL,
  nome text NOT NULL,
  tipo asset_type NOT NULL,
  setor text,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ==========================================
-- 3. TABELAS COM DEPENDÊNCIAS
-- ==========================================

-- asset_analyses
CREATE TABLE public.asset_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  carteira plan_type NOT NULL,
  recomendacao text,
  tendencia text,
  resumo text,
  perfil_investidor text,
  nota_especialista text,
  taxa_semanal numeric,
  valor numeric,
  roi2023a2025 numeric,
  roi2024 numeric,
  roi2025 numeric,
  roi2026 numeric,
  roitrim numeric,
  dy2025 numeric,
  fator_mc numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (asset_id)
);

-- asset_favorites
CREATE TABLE public.asset_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  asset_id uuid REFERENCES public.assets(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- asset_views
CREATE TABLE public.asset_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  asset_id uuid NOT NULL REFERENCES public.assets(id),
  viewed_at timestamptz NOT NULL DEFAULT now(),
  view_date date DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- wallet_simulator
CREATE TABLE public.wallet_simulator (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- wallet_items
CREATE TABLE public.wallet_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES public.wallet_simulator(id),
  asset_id uuid REFERENCES public.assets(id),
  quantidade integer NOT NULL,
  preco_compra numeric NOT NULL,
  aporte_adicional numeric DEFAULT 0,
  proventos numeric DEFAULT 0,
  data_compra date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- wallet_movements
CREATE TABLE public.wallet_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  asset_id uuid REFERENCES public.assets(id),
  codigo_b3 text NOT NULL,
  tipo_operacao operation_type NOT NULL,
  valor_por_acao numeric NOT NULL,
  quantidade integer NOT NULL,
  data_operacao date NOT NULL DEFAULT CURRENT_DATE,
  observacao text,
  created_at timestamptz DEFAULT now()
);

-- affiliates
CREATE TABLE public.affiliates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  affiliate_code text NOT NULL,
  commission_rate numeric NOT NULL DEFAULT 10.00,
  status affiliate_status NOT NULL DEFAULT 'pending',
  total_referrals integer NOT NULL DEFAULT 0,
  total_earnings numeric NOT NULL DEFAULT 0,
  last_revenue_at timestamptz,
  last_inactivity_notification text,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

-- affiliate_clicks
CREATE TABLE public.affiliate_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id),
  affiliate_code text NOT NULL,
  ip_address text,
  user_agent text,
  referrer text,
  landing_page text,
  session_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- referrals
CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id),
  referred_user_id uuid NOT NULL REFERENCES public.profiles(id),
  status text NOT NULL DEFAULT 'registered',
  converted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (referred_user_id)
);

-- commissions
CREATE TABLE public.commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id),
  referral_id uuid REFERENCES public.referrals(id),
  amount numeric NOT NULL,
  status commission_status NOT NULL DEFAULT 'pending',
  stripe_payment_id text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- blog_posts
CREATE TABLE public.blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL,
  content text NOT NULL,
  excerpt text,
  author text NOT NULL,
  author_id uuid,
  blog_author_id uuid REFERENCES public.blog_authors(id),
  cover_image text,
  og_image text,
  seo_title text,
  seo_description text,
  seo_keywords text[],
  status blog_status NOT NULL DEFAULT 'published',
  featured boolean NOT NULL DEFAULT false,
  views integer DEFAULT 0,
  published_at timestamptz,
  scheduled_for timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- post_categories
CREATE TABLE public.post_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.blog_posts(id),
  category_id uuid NOT NULL REFERENCES public.categories(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- profile_answers
CREATE TABLE public.profile_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  question_id uuid NOT NULL REFERENCES public.profile_questions(id),
  option_id uuid NOT NULL REFERENCES public.profile_options(id),
  cycle integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- notification_group_members
CREATE TABLE public.notification_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.notification_groups(id),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now()
);

-- push_subscriptions
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  device_id text,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- push_notifications
CREATE TABLE public.push_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  icon text DEFAULT '/logo.webp',
  url text DEFAULT '/',
  target_audience text DEFAULT 'all',
  target_plan text,
  target_group_id uuid REFERENCES public.notification_groups(id),
  is_active boolean DEFAULT true,
  sent_at timestamptz,
  sent_count integer DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- cancellation_feedback
CREATE TABLE public.cancellation_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  reason text NOT NULL,
  details text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- leads
CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  whatsapp text,
  landing_page text NOT NULL DEFAULT '/lp',
  affiliate_code text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  status text NOT NULL DEFAULT 'new',
  converted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- exclusive_videos
CREATE TABLE public.exclusive_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  youtube_id text NOT NULL,
  order_num integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- smtp_config
CREATE TABLE public.smtp_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  smtp_server text NOT NULL,
  smtp_port integer NOT NULL,
  smtp_user text NOT NULL,
  smtp_password text NOT NULL,
  sender_name text NOT NULL,
  sender_email text NOT NULL,
  security_type text NOT NULL DEFAULT 'TLS',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- tracking_events
CREATE TABLE public.tracking_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id uuid NOT NULL REFERENCES public.tracking_scripts(id),
  event_name text NOT NULL,
  event_data jsonb,
  user_id uuid,
  session_id text,
  page_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- admin_audit_log
CREATE TABLE public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL,
  granted_by uuid,
  old_plan plan_type,
  new_plan plan_type,
  role_assigned app_role,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- sync_logs
CREATE TABLE public.sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type text NOT NULL,
  status text NOT NULL,
  trigger_type text NOT NULL,
  triggered_by uuid,
  inserted integer DEFAULT 0,
  updated integer DEFAULT 0,
  failed integer DEFAULT 0,
  skipped integer DEFAULT 0,
  total_rows integer DEFAULT 0,
  errors jsonb,
  warnings jsonb,
  metadata jsonb,
  cancellation_requested boolean DEFAULT false,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- sync_queue
CREATE TABLE public.sync_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_log_id uuid REFERENCES public.sync_logs(id),
  row_index integer NOT NULL,
  row_data jsonb NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  error_message text,
  attempts integer NOT NULL DEFAULT 0,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- import_jobs
CREATE TABLE public.import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type import_type NOT NULL,
  filename text NOT NULL,
  status import_status NOT NULL DEFAULT 'PENDING',
  inserted integer DEFAULT 0,
  updated integer DEFAULT 0,
  failed integer DEFAULT 0,
  skipped integer DEFAULT 0,
  error_log jsonb,
  created_by uuid REFERENCES public.profiles(id),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- rate_limit_log
CREATE TABLE public.rate_limit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL,
  request_count integer DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ==========================================
-- 4. VIEW
-- ==========================================

CREATE OR REPLACE VIEW public.blog_authors_public AS
SELECT id, name, avatar_url, bio, created_at, updated_at
FROM public.blog_authors;

-- ==========================================
-- 5. FUNÇÕES
-- ==========================================

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, plan)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.email,
    'FREE'
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_affiliate_code()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    new_code := upper(substr(md5(random()::text), 1, 8));
    SELECT EXISTS(SELECT 1 FROM public.affiliates WHERE affiliate_code = new_code) INTO code_exists;
    EXIT WHEN NOT code_exists;
  END LOOP;
  RETURN new_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_affiliate(target_user_id uuid, custom_code text DEFAULT NULL, custom_rate numeric DEFAULT 10.00)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_affiliate_id UUID;
  final_code TEXT;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can create affiliates';
  END IF;
  IF EXISTS(SELECT 1 FROM public.affiliates WHERE user_id = target_user_id) THEN
    RAISE EXCEPTION 'User is already an affiliate';
  END IF;
  IF custom_code IS NOT NULL THEN
    final_code := upper(custom_code);
  ELSE
    final_code := generate_affiliate_code();
  END IF;
  INSERT INTO public.affiliates (user_id, affiliate_code, commission_rate, status)
  VALUES (target_user_id, final_code, custom_rate, 'active')
  RETURNING id INTO new_affiliate_id;
  RETURN new_affiliate_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_affiliate_activation()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_affiliate_id UUID;
  new_code TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;
  IF EXISTS(SELECT 1 FROM public.affiliates WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'User is already an affiliate';
  END IF;
  new_code := generate_affiliate_code();
  INSERT INTO public.affiliates (user_id, affiliate_code, commission_rate, status)
  VALUES (auth.uid(), new_code, 10.00, 'pending')
  RETURNING id INTO new_affiliate_id;
  RETURN new_affiliate_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_community_message_on_plan_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.plan IS DISTINCT FROM NEW.plan AND NEW.plan != 'FREE' THEN
    NEW.hide_community_message = false;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_admin_to_specialist()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_plan_value plan_type;
BEGIN
  IF NEW.role = 'admin' THEN
    SELECT plan INTO old_plan_value FROM public.profiles WHERE id = NEW.user_id;
    UPDATE public.profiles
    SET plan = 'SPECIALIST', plan_start_at = NOW(), plan_end_at = NULL
    WHERE id = NEW.user_id;
    INSERT INTO public.admin_audit_log (user_id, action, old_plan, new_plan, role_assigned, metadata)
    VALUES (NEW.user_id, 'admin_role_granted_auto_specialist', old_plan_value, 'SPECIALIST', 'admin',
      jsonb_build_object('trigger', 'on_admin_role_assigned', 'timestamp', NOW()));
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.rate_limit_log WHERE window_start < NOW() - INTERVAL '24 hours';
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_orphaned_syncs()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE sync_logs
  SET status = 'FAILED', completed_at = NOW(),
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('cleanup_reason', 'auto_cleanup_orphaned', 'cleaned_at', NOW()::text)
  WHERE status = 'IN_PROGRESS' AND started_at < NOW() - INTERVAL '10 minutes';
END;
$$;

CREATE OR REPLACE FUNCTION public.get_all_table_names()
RETURNS TABLE(table_name text) LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tablename::text as table_name FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
$$;

CREATE OR REPLACE FUNCTION public.create_asset_type_if_not_exists(type_name text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN true;
EXCEPTION WHEN OTHERS THEN RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_seo_keywords(title text, content text)
RETURNS text[] LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  keywords TEXT[];
  combined_text TEXT;
BEGIN
  combined_text := LOWER(title || ' ' || SUBSTRING(content, 1, 500));
  keywords := ARRAY(
    SELECT DISTINCT word FROM regexp_split_to_table(combined_text, '\s+') AS word
    WHERE LENGTH(word) > 4
      AND word !~ '^(https?|www|com|org|que|para|com|uma|seu|sua|mais|muito|sobre|como|quando|onde|porque|este|essa|isso|sido|sera|foi|tem|tinha|pode|fazer|todos|todas|cada|outro|outra|outros|outras|mesmo|mesma|algo|alguem|nada|ninguem|tudo|todo|toda|qualquer|qual|quais|algum|alguma|alguns|algumas|nenhum|nenhuma|apenas|somente|tambem|ainda|porem|contudo|entanto|portanto|assim|agora|depois|antes|durante|desde|ate|sempre|nunca|talvez)$'
    LIMIT 10
  );
  RETURN keywords;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_generate_seo()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.seo_title IS NULL OR NEW.seo_title = '' THEN
    NEW.seo_title := NEW.title;
  END IF;
  IF NEW.seo_description IS NULL OR NEW.seo_description = '' THEN
    NEW.seo_description := SUBSTRING(REGEXP_REPLACE(NEW.content, '<[^>]+>', '', 'g'), 1, 155);
  END IF;
  IF NEW.seo_keywords IS NULL OR array_length(NEW.seo_keywords, 1) IS NULL THEN
    NEW.seo_keywords := generate_seo_keywords(NEW.title, NEW.content);
  END IF;
  IF NEW.og_image IS NULL OR NEW.og_image = '' THEN
    NEW.og_image := NEW.cover_image;
  END IF;
  IF NEW.scheduled_for IS NOT NULL AND NEW.scheduled_for > NOW() THEN
    NEW.status := 'scheduled'::blog_status;
    NEW.published_at := NULL;
  ELSIF NEW.status = 'published'::blog_status AND NEW.published_at IS NULL THEN
    NEW.published_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;

-- ==========================================
-- 6. TRIGGERS
-- ==========================================

-- Trigger: novo usuário → criar perfil
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger: auto-update updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_assets_updated_at BEFORE UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_asset_analyses_updated_at BEFORE UPDATE ON public.asset_analyses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_affiliates_updated_at BEFORE UPDATE ON public.affiliates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_commissions_updated_at BEFORE UPDATE ON public.commissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_wallet_simulator_updated_at BEFORE UPDATE ON public.wallet_simulator FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_wallet_items_updated_at BEFORE UPDATE ON public.wallet_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_exclusive_videos_updated_at BEFORE UPDATE ON public.exclusive_videos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_push_notifications_updated_at BEFORE UPDATE ON public.push_notifications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_tracking_scripts_updated_at BEFORE UPDATE ON public.tracking_scripts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_subscription_plans_updated_at BEFORE UPDATE ON public.subscription_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_notification_groups_updated_at BEFORE UPDATE ON public.notification_groups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_push_subscriptions_updated_at BEFORE UPDATE ON public.push_subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Trigger: reset community message ao mudar plano
CREATE TRIGGER reset_community_message BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.reset_community_message_on_plan_change();

-- Trigger: admin → specialist auto
CREATE TRIGGER on_admin_role_assigned AFTER INSERT ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.sync_admin_to_specialist();

-- Trigger: auto SEO blog
CREATE TRIGGER auto_seo_blog_posts BEFORE INSERT OR UPDATE ON public.blog_posts FOR EACH ROW EXECUTE FUNCTION public.auto_generate_seo();

-- ==========================================
-- 7. RLS - HABILITAR
-- ==========================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_authors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_simulator ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cancellation_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exclusive_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smtp_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracking_scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_log ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- 8. RLS POLICIES
-- ==========================================

-- profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update all profiles" ON public.profiles FOR UPDATE USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- user_roles
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Block all direct inserts on user_roles" ON public.user_roles FOR INSERT WITH CHECK (false);
CREATE POLICY "Block all direct updates on user_roles" ON public.user_roles FOR UPDATE USING (false);
CREATE POLICY "Block all direct deletes on user_roles" ON public.user_roles FOR DELETE USING (false);

-- app_config
CREATE POLICY "Admins can manage app config" ON public.app_config FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated users can read public config keys" ON public.app_config FOR SELECT USING (key = 'community_whatsapp_link');

-- categories
CREATE POLICY "Anyone can view categories" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Admins can create categories" ON public.categories FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update categories" ON public.categories FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete categories" ON public.categories FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- blog_authors
CREATE POLICY "Admins can manage authors" ON public.blog_authors FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can view all author data" ON public.blog_authors FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Editors can view authors" ON public.blog_authors FOR SELECT USING (has_role(auth.uid(), 'editor'));

-- blog_posts
CREATE POLICY "Anyone can view published posts" ON public.blog_posts FOR SELECT USING (status = 'published');
CREATE POLICY "Admins can view all posts" ON public.blog_posts FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can create posts" ON public.blog_posts FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update posts" ON public.blog_posts FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete posts" ON public.blog_posts FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- post_categories
CREATE POLICY "Anyone can view post categories" ON public.post_categories FOR SELECT USING (true);
CREATE POLICY "Admins can manage post categories" ON public.post_categories FOR ALL USING (has_role(auth.uid(), 'admin'));

-- profile_questions (sem RLS explícita no contexto, adicionando padrão)
CREATE POLICY "Anyone can view questions" ON public.profile_questions FOR SELECT USING (true);
CREATE POLICY "Admins can manage questions" ON public.profile_questions FOR ALL USING (has_role(auth.uid(), 'admin'));

-- profile_options
CREATE POLICY "Anyone can view options" ON public.profile_options FOR SELECT USING (true);
CREATE POLICY "Admins can manage options" ON public.profile_options FOR ALL USING (has_role(auth.uid(), 'admin'));

-- profile_answers
CREATE POLICY "Users can view own answers" ON public.profile_answers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own answers" ON public.profile_answers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all answers" ON public.profile_answers FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Require authentication for profile_answers" ON public.profile_answers FOR ALL USING (auth.uid() IS NOT NULL);

-- subscription_plans
CREATE POLICY "Anyone can view active plans" ON public.subscription_plans FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage plans" ON public.subscription_plans FOR ALL USING (has_role(auth.uid(), 'admin'));

-- assets
CREATE POLICY "Anyone can view assets" ON public.assets FOR SELECT USING (true);
CREATE POLICY "Admins can insert assets" ON public.assets FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update assets" ON public.assets FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete assets" ON public.assets FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- asset_analyses
CREATE POLICY "Authenticated users can view all analyses" ON public.asset_analyses FOR SELECT USING (true);
CREATE POLICY "Public can view basic analyses" ON public.asset_analyses FOR SELECT USING (true);
CREATE POLICY "Admins can manage analyses" ON public.asset_analyses FOR ALL USING (has_role(auth.uid(), 'admin'));

-- asset_favorites
CREATE POLICY "Users can view their own favorites" ON public.asset_favorites FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can add their own favorites" ON public.asset_favorites FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove their own favorites" ON public.asset_favorites FOR DELETE USING (auth.uid() = user_id);

-- asset_views
CREATE POLICY "Users can view own asset views" ON public.asset_views FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own asset views" ON public.asset_views FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all asset views" ON public.asset_views FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- wallet_simulator
CREATE POLICY "Users can view own wallet" ON public.wallet_simulator FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own wallet" ON public.wallet_simulator FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own wallet" ON public.wallet_simulator FOR UPDATE USING (auth.uid() = user_id);

-- wallet_items
CREATE POLICY "Users can view own wallet items" ON public.wallet_items FOR SELECT USING (wallet_id IN (SELECT id FROM wallet_simulator WHERE user_id = auth.uid()));
CREATE POLICY "Users can insert own wallet items" ON public.wallet_items FOR INSERT WITH CHECK (wallet_id IN (SELECT id FROM wallet_simulator WHERE user_id = auth.uid()));
CREATE POLICY "Users can update own wallet items" ON public.wallet_items FOR UPDATE USING (wallet_id IN (SELECT id FROM wallet_simulator WHERE user_id = auth.uid()));
CREATE POLICY "Users can delete own wallet items" ON public.wallet_items FOR DELETE USING (wallet_id IN (SELECT id FROM wallet_simulator WHERE user_id = auth.uid()));

-- wallet_movements
CREATE POLICY "Users can view own movements" ON public.wallet_movements FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own movements" ON public.wallet_movements FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own movements" ON public.wallet_movements FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own movements" ON public.wallet_movements FOR DELETE USING (auth.uid() = user_id);

-- affiliates
CREATE POLICY "Affiliates can view own data" ON public.affiliates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all affiliates" ON public.affiliates FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert affiliates" ON public.affiliates FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update affiliates" ON public.affiliates FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete affiliates" ON public.affiliates FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- affiliate_clicks
CREATE POLICY "Admins can view all clicks" ON public.affiliate_clicks FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Affiliates can view own clicks" ON public.affiliate_clicks FOR SELECT USING (affiliate_id IN (SELECT id FROM affiliates WHERE user_id = auth.uid()));
CREATE POLICY "Block all direct inserts on affiliate clicks" ON public.affiliate_clicks FOR INSERT WITH CHECK (false);

-- referrals
CREATE POLICY "Admins can manage referrals" ON public.referrals FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can view all referrals" ON public.referrals FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Affiliates can view own referrals" ON public.referrals FOR SELECT USING (affiliate_id IN (SELECT id FROM affiliates WHERE user_id = auth.uid()));
CREATE POLICY "Users can insert own referral" ON public.referrals FOR INSERT WITH CHECK (referred_user_id = auth.uid());

-- commissions
CREATE POLICY "Admins can manage commissions" ON public.commissions FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can view all commissions" ON public.commissions FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Affiliates can view own commissions" ON public.commissions FOR SELECT USING (affiliate_id IN (SELECT id FROM affiliates WHERE user_id = auth.uid()));

-- notification_groups
CREATE POLICY "Admins can manage notification groups" ON public.notification_groups FOR ALL USING (has_role(auth.uid(), 'admin'));

-- notification_group_members
CREATE POLICY "Admins can manage group members" ON public.notification_group_members FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view own group memberships" ON public.notification_group_members FOR SELECT USING (auth.uid() = user_id);

-- push_subscriptions
CREATE POLICY "Users can manage own subscriptions" ON public.push_subscriptions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all subscriptions" ON public.push_subscriptions FOR SELECT USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'));

-- push_notifications
CREATE POLICY "Admins can manage notifications" ON public.push_notifications FOR ALL USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role IN ('admin', 'editor')));

-- cancellation_feedback
CREATE POLICY "Users can view own feedback" ON public.cancellation_feedback FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own feedback" ON public.cancellation_feedback FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all feedback" ON public.cancellation_feedback FOR SELECT USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'));

-- leads
CREATE POLICY "Anyone can submit a lead" ON public.leads FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can view leads" ON public.leads FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update leads" ON public.leads FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete leads" ON public.leads FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- exclusive_videos
CREATE POLICY "Authenticated users can view active videos" ON public.exclusive_videos FOR SELECT USING (auth.uid() IS NOT NULL AND is_active = true);
CREATE POLICY "Admins can view all videos" ON public.exclusive_videos FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage videos" ON public.exclusive_videos FOR ALL USING (has_role(auth.uid(), 'admin'));

-- smtp_config
CREATE POLICY "Admins can manage SMTP config" ON public.smtp_config FOR ALL USING (has_role(auth.uid(), 'admin'));

-- tracking_scripts
CREATE POLICY "Admins can manage tracking scripts" ON public.tracking_scripts FOR ALL USING (has_role(auth.uid(), 'admin'));

-- tracking_events
CREATE POLICY "Admins can view all tracking events" ON public.tracking_events FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Block all direct inserts on tracking events" ON public.tracking_events FOR INSERT WITH CHECK (false);

-- admin_audit_log
CREATE POLICY "Admins can view audit logs" ON public.admin_audit_log FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Block all direct inserts on audit logs" ON public.admin_audit_log FOR INSERT WITH CHECK (false);
CREATE POLICY "Block audit log modifications" ON public.admin_audit_log FOR UPDATE USING (false);
CREATE POLICY "Block audit log deletions" ON public.admin_audit_log FOR DELETE USING (false);

-- sync_logs
CREATE POLICY "Admins can view sync logs" ON public.sync_logs FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert sync logs" ON public.sync_logs FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update sync logs" ON public.sync_logs FOR UPDATE USING (has_role(auth.uid(), 'admin'));

-- sync_queue
CREATE POLICY "Admins can view sync queue" ON public.sync_queue FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Block direct inserts on sync queue" ON public.sync_queue FOR INSERT WITH CHECK (false);
CREATE POLICY "Block direct updates on sync queue" ON public.sync_queue FOR UPDATE USING (false);
CREATE POLICY "Block direct deletes on sync queue" ON public.sync_queue FOR DELETE USING (false);

-- import_jobs
CREATE POLICY "Admins can view import jobs" ON public.import_jobs FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can create import jobs" ON public.import_jobs FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));

-- rate_limit_log
CREATE POLICY "Users can view own rate limits" ON public.rate_limit_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Block all direct inserts on rate limit log" ON public.rate_limit_log FOR INSERT WITH CHECK (false);

-- ==========================================
-- 9. STORAGE
-- ==========================================

INSERT INTO storage.buckets (id, name, public) VALUES ('blog-images', 'blog-images', true);

CREATE POLICY "Public read blog images" ON storage.objects FOR SELECT USING (bucket_id = 'blog-images');
CREATE POLICY "Admins can manage blog images" ON storage.objects FOR ALL USING (bucket_id = 'blog-images' AND public.has_role(auth.uid(), 'admin'));

-- ==========================================
-- FIM DO EXPORT
-- ==========================================
