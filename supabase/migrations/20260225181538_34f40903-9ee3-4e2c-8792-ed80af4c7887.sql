
-- =============================================
-- STEP 0: Add UNIQUE constraints on id columns that need to be referenced by FKs
-- =============================================

-- assets.id
ALTER TABLE public.assets ALTER COLUMN id SET NOT NULL;
ALTER TABLE public.assets ADD CONSTRAINT assets_pkey UNIQUE (id);

-- wallet_simulator.id  
ALTER TABLE public.wallet_simulator ALTER COLUMN id SET NOT NULL;
ALTER TABLE public.wallet_simulator ADD CONSTRAINT wallet_simulator_pkey UNIQUE (id);

-- blog_authors.id
ALTER TABLE public.blog_authors ALTER COLUMN id SET NOT NULL;
ALTER TABLE public.blog_authors ADD CONSTRAINT blog_authors_pkey UNIQUE (id);

-- blog_posts.id
ALTER TABLE public.blog_posts ALTER COLUMN id SET NOT NULL;
ALTER TABLE public.blog_posts ADD CONSTRAINT blog_posts_pkey UNIQUE (id);

-- categories.id
ALTER TABLE public.categories ALTER COLUMN id SET NOT NULL;
ALTER TABLE public.categories ADD CONSTRAINT categories_pkey UNIQUE (id);

-- affiliates.id
ALTER TABLE public.affiliates ALTER COLUMN id SET NOT NULL;
ALTER TABLE public.affiliates ADD CONSTRAINT affiliates_pkey UNIQUE (id);

-- referrals.id
ALTER TABLE public.referrals ALTER COLUMN id SET NOT NULL;
ALTER TABLE public.referrals ADD CONSTRAINT referrals_pkey UNIQUE (id);

-- =============================================
-- STEP 1: Add Foreign Keys
-- =============================================

ALTER TABLE public.asset_analyses
  ADD CONSTRAINT asset_analyses_asset_id_fkey
  FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;

ALTER TABLE public.wallet_items
  ADD CONSTRAINT wallet_items_wallet_id_fkey
  FOREIGN KEY (wallet_id) REFERENCES public.wallet_simulator(id) ON DELETE CASCADE;

ALTER TABLE public.wallet_items
  ADD CONSTRAINT wallet_items_asset_id_fkey
  FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE SET NULL;

ALTER TABLE public.asset_favorites
  ADD CONSTRAINT asset_favorites_asset_id_fkey
  FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE SET NULL;

ALTER TABLE public.asset_favorites
  ADD CONSTRAINT asset_favorites_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.wallet_movements
  ADD CONSTRAINT wallet_movements_asset_id_fkey
  FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE SET NULL;

ALTER TABLE public.blog_posts
  ADD CONSTRAINT blog_posts_blog_author_id_fkey
  FOREIGN KEY (blog_author_id) REFERENCES public.blog_authors(id) ON DELETE SET NULL;

ALTER TABLE public.post_categories
  ADD CONSTRAINT post_categories_post_id_fkey
  FOREIGN KEY (post_id) REFERENCES public.blog_posts(id) ON DELETE CASCADE;

ALTER TABLE public.post_categories
  ADD CONSTRAINT post_categories_category_id_fkey
  FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE;

ALTER TABLE public.commissions
  ADD CONSTRAINT commissions_affiliate_id_fkey
  FOREIGN KEY (affiliate_id) REFERENCES public.affiliates(id) ON DELETE CASCADE;

ALTER TABLE public.commissions
  ADD CONSTRAINT commissions_referral_id_fkey
  FOREIGN KEY (referral_id) REFERENCES public.referrals(id) ON DELETE SET NULL;

ALTER TABLE public.referrals
  ADD CONSTRAINT referrals_affiliate_id_fkey
  FOREIGN KEY (affiliate_id) REFERENCES public.affiliates(id) ON DELETE CASCADE;

-- =============================================
-- STEP 2: Recreate ALL RLS policies as PERMISSIVE
-- =============================================

-- ---- profiles ----
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "System can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Require authentication for profiles" ON public.profiles;

CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins can update all profiles" ON public.profiles FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "System can insert profiles" ON public.profiles FOR INSERT WITH CHECK (true);

-- ---- user_roles ----
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Authenticated can read own roles" ON public.user_roles;
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated can read own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- ---- assets ----
DROP POLICY IF EXISTS "Admins can manage assets" ON public.assets;
DROP POLICY IF EXISTS "Anyone can view assets" ON public.assets;
CREATE POLICY "Admins can manage assets" ON public.assets FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can view assets" ON public.assets FOR SELECT USING (true);

-- ---- asset_analyses ----
DROP POLICY IF EXISTS "Admins can manage analyses" ON public.asset_analyses;
DROP POLICY IF EXISTS "Anyone can view analyses" ON public.asset_analyses;
DROP POLICY IF EXISTS "Authenticated users can view analyses matching their plan" ON public.asset_analyses;
CREATE POLICY "Admins can manage analyses" ON public.asset_analyses FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can view analyses" ON public.asset_analyses FOR SELECT USING (true);

-- ---- wallet_simulator ----
DROP POLICY IF EXISTS "Users can view own wallet" ON public.wallet_simulator;
DROP POLICY IF EXISTS "Users can insert own wallet" ON public.wallet_simulator;
DROP POLICY IF EXISTS "Users can update own wallet" ON public.wallet_simulator;
DROP POLICY IF EXISTS "Users can delete own wallet" ON public.wallet_simulator;
CREATE POLICY "Users can view own wallet" ON public.wallet_simulator FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own wallet" ON public.wallet_simulator FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own wallet" ON public.wallet_simulator FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own wallet" ON public.wallet_simulator FOR DELETE USING (auth.uid() = user_id);

-- ---- wallet_items ----
DROP POLICY IF EXISTS "Users can view own wallet items" ON public.wallet_items;
DROP POLICY IF EXISTS "Users can insert own wallet items" ON public.wallet_items;
DROP POLICY IF EXISTS "Users can update own wallet items" ON public.wallet_items;
DROP POLICY IF EXISTS "Users can delete own wallet items" ON public.wallet_items;
CREATE POLICY "Users can view own wallet items" ON public.wallet_items FOR SELECT USING (EXISTS (SELECT 1 FROM wallet_simulator ws WHERE ws.id = wallet_items.wallet_id AND ws.user_id = auth.uid()));
CREATE POLICY "Users can insert own wallet items" ON public.wallet_items FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM wallet_simulator ws WHERE ws.id = wallet_items.wallet_id AND ws.user_id = auth.uid()));
CREATE POLICY "Users can update own wallet items" ON public.wallet_items FOR UPDATE USING (EXISTS (SELECT 1 FROM wallet_simulator ws WHERE ws.id = wallet_items.wallet_id AND ws.user_id = auth.uid()));
CREATE POLICY "Users can delete own wallet items" ON public.wallet_items FOR DELETE USING (EXISTS (SELECT 1 FROM wallet_simulator ws WHERE ws.id = wallet_items.wallet_id AND ws.user_id = auth.uid()));

-- ---- wallet_movements ----
DROP POLICY IF EXISTS "Users can view own movements" ON public.wallet_movements;
DROP POLICY IF EXISTS "Users can insert own movements" ON public.wallet_movements;
DROP POLICY IF EXISTS "Users can update own movements" ON public.wallet_movements;
DROP POLICY IF EXISTS "Users can delete own movements" ON public.wallet_movements;
CREATE POLICY "Users can view own movements" ON public.wallet_movements FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own movements" ON public.wallet_movements FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own movements" ON public.wallet_movements FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own movements" ON public.wallet_movements FOR DELETE USING (auth.uid() = user_id);

-- ---- asset_favorites ----
DROP POLICY IF EXISTS "Users can manage own favorites" ON public.asset_favorites;
DROP POLICY IF EXISTS "Users can insert own favorites" ON public.asset_favorites;
CREATE POLICY "Users can manage own favorites" ON public.asset_favorites FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own favorites" ON public.asset_favorites FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ---- asset_views ----
DROP POLICY IF EXISTS "Users can manage own views" ON public.asset_views;
DROP POLICY IF EXISTS "Users can insert own views" ON public.asset_views;
CREATE POLICY "Users can manage own views" ON public.asset_views FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own views" ON public.asset_views FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ---- subscription_plans ----
DROP POLICY IF EXISTS "Admins can manage plans" ON public.subscription_plans;
DROP POLICY IF EXISTS "Anyone can view plans" ON public.subscription_plans;
CREATE POLICY "Admins can manage plans" ON public.subscription_plans FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can view plans" ON public.subscription_plans FOR SELECT USING (true);

-- ---- blog_posts ----
DROP POLICY IF EXISTS "Admins can manage posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Anyone can view published posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Editors can manage posts" ON public.blog_posts;
CREATE POLICY "Admins can manage posts" ON public.blog_posts FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can view published posts" ON public.blog_posts FOR SELECT USING (true);
CREATE POLICY "Editors can manage posts" ON public.blog_posts FOR ALL USING (has_role(auth.uid(), 'editor'::app_role));

-- ---- blog_authors ----
DROP POLICY IF EXISTS "Admins can manage authors" ON public.blog_authors;
DROP POLICY IF EXISTS "Anyone can view authors" ON public.blog_authors;
CREATE POLICY "Admins can manage authors" ON public.blog_authors FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can view authors" ON public.blog_authors FOR SELECT USING (true);

-- ---- blog_authors_public ----
DROP POLICY IF EXISTS "Admins can manage public authors" ON public.blog_authors_public;
DROP POLICY IF EXISTS "Anyone can view public authors" ON public.blog_authors_public;
CREATE POLICY "Admins can manage public authors" ON public.blog_authors_public FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can view public authors" ON public.blog_authors_public FOR SELECT USING (true);

-- ---- categories ----
DROP POLICY IF EXISTS "Admins can manage categories" ON public.categories;
DROP POLICY IF EXISTS "Anyone can view categories" ON public.categories;
CREATE POLICY "Admins can manage categories" ON public.categories FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can view categories" ON public.categories FOR SELECT USING (true);

-- ---- post_categories ----
DROP POLICY IF EXISTS "Admins can manage post categories" ON public.post_categories;
DROP POLICY IF EXISTS "Anyone can view post categories" ON public.post_categories;
DROP POLICY IF EXISTS "Editors can manage post categories" ON public.post_categories;
CREATE POLICY "Admins can manage post categories" ON public.post_categories FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can view post categories" ON public.post_categories FOR SELECT USING (true);
CREATE POLICY "Editors can manage post categories" ON public.post_categories FOR ALL USING (has_role(auth.uid(), 'editor'::app_role));

-- ---- affiliates ----
DROP POLICY IF EXISTS "Admins manage affiliates" ON public.affiliates;
DROP POLICY IF EXISTS "System can insert affiliates" ON public.affiliates;
DROP POLICY IF EXISTS "Users view own affiliate" ON public.affiliates;
CREATE POLICY "Admins manage affiliates" ON public.affiliates FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "System can insert affiliates" ON public.affiliates FOR INSERT WITH CHECK (true);
CREATE POLICY "Users view own affiliate" ON public.affiliates FOR SELECT USING (auth.uid() = user_id);

-- ---- commissions ----
DROP POLICY IF EXISTS "Admins manage commissions" ON public.commissions;
DROP POLICY IF EXISTS "Users view own commissions" ON public.commissions;
CREATE POLICY "Admins manage commissions" ON public.commissions FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users view own commissions" ON public.commissions FOR SELECT USING (EXISTS (SELECT 1 FROM affiliates a WHERE a.id = commissions.affiliate_id AND a.user_id = auth.uid()));

-- ---- referrals ----
DROP POLICY IF EXISTS "Admins manage referrals" ON public.referrals;
DROP POLICY IF EXISTS "Users view own referrals" ON public.referrals;
CREATE POLICY "Admins manage referrals" ON public.referrals FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users view own referrals" ON public.referrals FOR SELECT USING (EXISTS (SELECT 1 FROM affiliates a WHERE a.id = referrals.affiliate_id AND a.user_id = auth.uid()));

-- ---- affiliate_clicks ----
DROP POLICY IF EXISTS "Admins view clicks" ON public.affiliate_clicks;
DROP POLICY IF EXISTS "Anyone can insert clicks" ON public.affiliate_clicks;
CREATE POLICY "Admins view clicks" ON public.affiliate_clicks FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can insert clicks" ON public.affiliate_clicks FOR INSERT WITH CHECK (true);

-- ---- leads ----
DROP POLICY IF EXISTS "Admins manage leads" ON public.leads;
DROP POLICY IF EXISTS "Anyone can insert leads" ON public.leads;
CREATE POLICY "Admins manage leads" ON public.leads FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can insert leads" ON public.leads FOR INSERT WITH CHECK (true);

-- ---- cancellation_feedback ----
DROP POLICY IF EXISTS "Admins view feedback" ON public.cancellation_feedback;
DROP POLICY IF EXISTS "Users insert own feedback" ON public.cancellation_feedback;
CREATE POLICY "Admins view feedback" ON public.cancellation_feedback FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users insert own feedback" ON public.cancellation_feedback FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ---- app_config ----
DROP POLICY IF EXISTS "Admins can manage config" ON public.app_config;
DROP POLICY IF EXISTS "Anyone can read config" ON public.app_config;
CREATE POLICY "Admins can manage config" ON public.app_config FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can read config" ON public.app_config FOR SELECT USING (true);

-- ---- smtp_config ----
DROP POLICY IF EXISTS "Admins can manage smtp" ON public.smtp_config;
CREATE POLICY "Admins can manage smtp" ON public.smtp_config FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- ---- admin_audit_log ----
DROP POLICY IF EXISTS "Admins can insert audit log" ON public.admin_audit_log;
DROP POLICY IF EXISTS "Admins can manage audit log" ON public.admin_audit_log;
CREATE POLICY "Admins can manage audit log" ON public.admin_audit_log FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- ---- push_notifications ----
DROP POLICY IF EXISTS "Admins manage notifications" ON public.push_notifications;
CREATE POLICY "Admins manage notifications" ON public.push_notifications FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- ---- push_subscriptions ----
DROP POLICY IF EXISTS "Admins view subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users insert own subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users manage own subscriptions" ON public.push_subscriptions;
CREATE POLICY "Admins view subscriptions" ON public.push_subscriptions FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users manage own subscriptions" ON public.push_subscriptions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users insert own subscriptions" ON public.push_subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ---- notification_groups ----
DROP POLICY IF EXISTS "Admins manage groups" ON public.notification_groups;
CREATE POLICY "Admins manage groups" ON public.notification_groups FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- ---- notification_group_members ----
DROP POLICY IF EXISTS "Admins manage members" ON public.notification_group_members;
CREATE POLICY "Admins manage members" ON public.notification_group_members FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- ---- tracking_scripts ----
DROP POLICY IF EXISTS "Admins can manage scripts" ON public.tracking_scripts;
CREATE POLICY "Admins can manage scripts" ON public.tracking_scripts FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- ---- tracking_events ----
DROP POLICY IF EXISTS "Admins can view events" ON public.tracking_events;
DROP POLICY IF EXISTS "Anyone can insert events" ON public.tracking_events;
CREATE POLICY "Admins can view events" ON public.tracking_events FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can insert events" ON public.tracking_events FOR INSERT WITH CHECK (true);

-- ---- sync_logs ----
DROP POLICY IF EXISTS "Admins manage sync logs" ON public.sync_logs;
CREATE POLICY "Admins manage sync logs" ON public.sync_logs FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- ---- sync_queue ----
DROP POLICY IF EXISTS "Admins manage sync queue" ON public.sync_queue;
CREATE POLICY "Admins manage sync queue" ON public.sync_queue FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- ---- import_jobs ----
DROP POLICY IF EXISTS "Admins manage imports" ON public.import_jobs;
CREATE POLICY "Admins manage imports" ON public.import_jobs FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- ---- rate_limit_log ----
DROP POLICY IF EXISTS "System can manage rate limits" ON public.rate_limit_log;
CREATE POLICY "System can manage rate limits" ON public.rate_limit_log FOR ALL USING (true);

-- ---- profile_questions ----
DROP POLICY IF EXISTS "Admins manage questions" ON public.profile_questions;
DROP POLICY IF EXISTS "Anyone can view questions" ON public.profile_questions;
CREATE POLICY "Admins manage questions" ON public.profile_questions FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can view questions" ON public.profile_questions FOR SELECT USING (true);

-- ---- profile_options ----
DROP POLICY IF EXISTS "Admins manage options" ON public.profile_options;
DROP POLICY IF EXISTS "Anyone can view options" ON public.profile_options;
CREATE POLICY "Admins manage options" ON public.profile_options FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can view options" ON public.profile_options FOR SELECT USING (true);

-- ---- profile_answers ----
DROP POLICY IF EXISTS "Admins view all answers" ON public.profile_answers;
DROP POLICY IF EXISTS "Users insert own answers" ON public.profile_answers;
DROP POLICY IF EXISTS "Users manage own answers" ON public.profile_answers;
DROP POLICY IF EXISTS "Require authentication for profile_answers" ON public.profile_answers;
CREATE POLICY "Admins view all answers" ON public.profile_answers FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users manage own answers" ON public.profile_answers FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users insert own answers" ON public.profile_answers FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ---- exclusive_videos ----
DROP POLICY IF EXISTS "Admins manage videos" ON public.exclusive_videos;
DROP POLICY IF EXISTS "Authenticated view videos" ON public.exclusive_videos;
CREATE POLICY "Admins manage videos" ON public.exclusive_videos FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated view videos" ON public.exclusive_videos FOR SELECT USING (true);

-- ---- sites ----
DROP POLICY IF EXISTS "Admins manage sites" ON public.sites;
DROP POLICY IF EXISTS "Anyone can view sites" ON public.sites;
CREATE POLICY "Admins manage sites" ON public.sites FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can view sites" ON public.sites FOR SELECT USING (true);
