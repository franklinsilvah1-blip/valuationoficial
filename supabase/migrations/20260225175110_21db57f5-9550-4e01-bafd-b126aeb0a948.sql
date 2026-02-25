
-- ==========================================
-- ETAPA 2: Enums, Functions, Triggers
-- ==========================================

-- Create app_role enum
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'editor', 'moderator');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create plan_type enum
DO $$ BEGIN
  CREATE TYPE public.plan_type AS ENUM ('FREE', 'START', 'PRO', 'SPECIALIST', 'FALE_C_ESPECIALISTA');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Function: has_role (security definer, no RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role::text
  )
$$;

-- Function: handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, plan)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.email,
    'FREE'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Trigger: on_auth_user_created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function: update_updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Function: request_affiliate_activation
CREATE OR REPLACE FUNCTION public.request_affiliate_activation()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
  new_code text;
BEGIN
  -- Generate a unique affiliate code
  new_code := 'VIT-' || upper(substr(md5(random()::text), 1, 6));
  
  INSERT INTO public.affiliates (id, user_id, affiliate_code, status, commission_rate, total_referrals, total_earnings, created_at, updated_at)
  VALUES (
    gen_random_uuid(),
    auth.uid(),
    new_code,
    'pending',
    10,
    0,
    0,
    now()::text,
    now()::text
  )
  RETURNING id INTO new_id;
  
  RETURN new_id;
END;
$$;

-- Function: cleanup_old_rate_limits
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.rate_limit_log
  WHERE window_start::timestamptz < NOW() - INTERVAL '24 hours';
END;
$$;

-- Function: reset_community_message_on_plan_change
CREATE OR REPLACE FUNCTION public.reset_community_message_on_plan_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.plan IS DISTINCT FROM NEW.plan AND NEW.plan != 'FREE' THEN
    NEW.hide_community_message = false;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger for reset community message
DROP TRIGGER IF EXISTS reset_community_message ON public.profiles;
CREATE TRIGGER reset_community_message
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.reset_community_message_on_plan_change();

-- ==========================================
-- ETAPA 3: Enable RLS + Policies on ALL tables
-- ==========================================

-- profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update all profiles" ON public.profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "System can insert profiles" ON public.profiles FOR INSERT WITH CHECK (true);

-- user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can read all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- admin_audit_log
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage audit log" ON public.admin_audit_log FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert audit log" ON public.admin_audit_log FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- assets (public read, admin manage)
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view assets" ON public.assets FOR SELECT USING (true);
CREATE POLICY "Admins can manage assets" ON public.assets FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- asset_analyses (public read, admin manage)
ALTER TABLE public.asset_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view analyses" ON public.asset_analyses FOR SELECT USING (true);
CREATE POLICY "Admins can manage analyses" ON public.asset_analyses FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- asset_favorites
ALTER TABLE public.asset_favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own favorites" ON public.asset_favorites FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own favorites" ON public.asset_favorites FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- asset_views
ALTER TABLE public.asset_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own views" ON public.asset_views FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own views" ON public.asset_views FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- wallet_simulator
ALTER TABLE public.wallet_simulator ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own wallet" ON public.wallet_simulator FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own wallet" ON public.wallet_simulator FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- wallet_items
ALTER TABLE public.wallet_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own wallet items" ON public.wallet_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.wallet_simulator ws WHERE ws.id = wallet_id AND ws.user_id = auth.uid()));
CREATE POLICY "Users insert own wallet items" ON public.wallet_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.wallet_simulator ws WHERE ws.id = wallet_id AND ws.user_id = auth.uid()));

-- wallet_movements
ALTER TABLE public.wallet_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own movements" ON public.wallet_movements FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own movements" ON public.wallet_movements FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- blog_posts (public read, admin/editor manage)
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view published posts" ON public.blog_posts FOR SELECT USING (true);
CREATE POLICY "Admins can manage posts" ON public.blog_posts FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Editors can manage posts" ON public.blog_posts FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'editor'));

-- blog_authors
ALTER TABLE public.blog_authors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view authors" ON public.blog_authors FOR SELECT USING (true);
CREATE POLICY "Admins can manage authors" ON public.blog_authors FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- blog_authors_public
ALTER TABLE public.blog_authors_public ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view public authors" ON public.blog_authors_public FOR SELECT USING (true);
CREATE POLICY "Admins can manage public authors" ON public.blog_authors_public FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- categories
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view categories" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Admins can manage categories" ON public.categories FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- post_categories
ALTER TABLE public.post_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view post categories" ON public.post_categories FOR SELECT USING (true);
CREATE POLICY "Admins can manage post categories" ON public.post_categories FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Editors can manage post categories" ON public.post_categories FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'editor'));

-- subscription_plans (public read, admin manage)
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view plans" ON public.subscription_plans FOR SELECT USING (true);
CREATE POLICY "Admins can manage plans" ON public.subscription_plans FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- app_config (admin only)
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage config" ON public.app_config FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- smtp_config (admin only)
ALTER TABLE public.smtp_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage smtp" ON public.smtp_config FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- tracking_scripts (admin only)
ALTER TABLE public.tracking_scripts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage scripts" ON public.tracking_scripts FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- tracking_events
ALTER TABLE public.tracking_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can insert events" ON public.tracking_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can view events" ON public.tracking_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- affiliates
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own affiliate" ON public.affiliates FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins manage affiliates" ON public.affiliates FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "System can insert affiliates" ON public.affiliates FOR INSERT WITH CHECK (true);

-- affiliate_clicks
ALTER TABLE public.affiliate_clicks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can insert clicks" ON public.affiliate_clicks FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins view clicks" ON public.affiliate_clicks FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- referrals
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own referrals" ON public.referrals FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.affiliates a WHERE a.id = affiliate_id AND a.user_id = auth.uid()));
CREATE POLICY "Admins manage referrals" ON public.referrals FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- commissions
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own commissions" ON public.commissions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.affiliates a WHERE a.id = affiliate_id AND a.user_id = auth.uid()));
CREATE POLICY "Admins manage commissions" ON public.commissions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- leads
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can insert leads" ON public.leads FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins manage leads" ON public.leads FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- cancellation_feedback
ALTER TABLE public.cancellation_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users insert own feedback" ON public.cancellation_feedback FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view feedback" ON public.cancellation_feedback FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- profile_questions (public read)
ALTER TABLE public.profile_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view questions" ON public.profile_questions FOR SELECT USING (true);
CREATE POLICY "Admins manage questions" ON public.profile_questions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- profile_options (public read)
ALTER TABLE public.profile_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view options" ON public.profile_options FOR SELECT USING (true);
CREATE POLICY "Admins manage options" ON public.profile_options FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- profile_answers
ALTER TABLE public.profile_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own answers" ON public.profile_answers FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own answers" ON public.profile_answers FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all answers" ON public.profile_answers FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- push_notifications (admin only)
ALTER TABLE public.push_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage notifications" ON public.push_notifications FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- push_subscriptions
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own subscriptions" ON public.push_subscriptions FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own subscriptions" ON public.push_subscriptions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view subscriptions" ON public.push_subscriptions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- notification_groups (admin only)
ALTER TABLE public.notification_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage groups" ON public.notification_groups FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- notification_group_members
ALTER TABLE public.notification_group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage members" ON public.notification_group_members FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- exclusive_videos (authenticated read, admin manage)
ALTER TABLE public.exclusive_videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated view videos" ON public.exclusive_videos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage videos" ON public.exclusive_videos FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- sites
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view sites" ON public.sites FOR SELECT USING (true);
CREATE POLICY "Admins manage sites" ON public.sites FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- sync_logs (admin only)
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage sync logs" ON public.sync_logs FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- sync_queue (admin only)
ALTER TABLE public.sync_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage sync queue" ON public.sync_queue FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- import_jobs (admin only)
ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage imports" ON public.import_jobs FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- rate_limit_log
ALTER TABLE public.rate_limit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "System can manage rate limits" ON public.rate_limit_log FOR ALL USING (true);

-- ==========================================
-- ETAPA 4: Fix column types
-- ==========================================

-- Fix admin_audit_log.metadata from text to jsonb
ALTER TABLE public.admin_audit_log ALTER COLUMN metadata TYPE jsonb USING CASE WHEN metadata IS NULL THEN NULL WHEN metadata = '' THEN NULL ELSE metadata::jsonb END;

-- Fix subscription_plans.features from text to jsonb
ALTER TABLE public.subscription_plans ALTER COLUMN features TYPE jsonb USING CASE WHEN features IS NULL THEN NULL WHEN features = '' THEN '[]'::jsonb ELSE features::jsonb END;

-- Fix blog_posts.seo_keywords ensure jsonb (already jsonb per schema but confirm)
-- Already jsonb, skip

-- Add primary key constraints where missing
DO $$ BEGIN
  -- profiles
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_pkey') THEN
    ALTER TABLE public.profiles ADD PRIMARY KEY (id);
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Add default values for id and created_at where missing
ALTER TABLE public.profiles ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.profiles ALTER COLUMN created_at SET DEFAULT now()::text;

-- Add unique constraint on profiles.email if not exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_email_key') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_email_key UNIQUE (email);
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Add unique constraint on user_roles (user_id, role) if not exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_user_id_role_key') THEN
    ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Add unique constraint on asset_analyses (asset_id, carteira) if not exists  
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'asset_analyses_asset_carteira_unique') THEN
    ALTER TABLE public.asset_analyses ADD CONSTRAINT asset_analyses_asset_carteira_unique UNIQUE (asset_id, carteira);
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
