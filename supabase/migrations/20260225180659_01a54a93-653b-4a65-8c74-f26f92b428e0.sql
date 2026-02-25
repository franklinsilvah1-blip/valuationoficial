
-- Fix: All policies were created as RESTRICTIVE instead of PERMISSIVE
-- Drop and recreate wallet-related policies as PERMISSIVE (default)

-- ============ wallet_simulator ============
DROP POLICY IF EXISTS "Users insert own wallet" ON public.wallet_simulator;
DROP POLICY IF EXISTS "Users manage own wallet" ON public.wallet_simulator;

CREATE POLICY "Users can view own wallet"
ON public.wallet_simulator FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own wallet"
ON public.wallet_simulator FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own wallet"
ON public.wallet_simulator FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own wallet"
ON public.wallet_simulator FOR DELETE
USING (auth.uid() = user_id);

-- ============ wallet_items ============
DROP POLICY IF EXISTS "Users insert own wallet items" ON public.wallet_items;
DROP POLICY IF EXISTS "Users manage own wallet items" ON public.wallet_items;

CREATE POLICY "Users can view own wallet items"
ON public.wallet_items FOR SELECT
USING (EXISTS (
  SELECT 1 FROM wallet_simulator ws
  WHERE ws.id = wallet_items.wallet_id AND ws.user_id = auth.uid()
));

CREATE POLICY "Users can insert own wallet items"
ON public.wallet_items FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM wallet_simulator ws
  WHERE ws.id = wallet_items.wallet_id AND ws.user_id = auth.uid()
));

CREATE POLICY "Users can update own wallet items"
ON public.wallet_items FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM wallet_simulator ws
  WHERE ws.id = wallet_items.wallet_id AND ws.user_id = auth.uid()
));

CREATE POLICY "Users can delete own wallet items"
ON public.wallet_items FOR DELETE
USING (EXISTS (
  SELECT 1 FROM wallet_simulator ws
  WHERE ws.id = wallet_items.wallet_id AND ws.user_id = auth.uid()
));

-- ============ wallet_movements ============
DROP POLICY IF EXISTS "Users insert own movements" ON public.wallet_movements;
DROP POLICY IF EXISTS "Users manage own movements" ON public.wallet_movements;

CREATE POLICY "Users can view own movements"
ON public.wallet_movements FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own movements"
ON public.wallet_movements FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own movements"
ON public.wallet_movements FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own movements"
ON public.wallet_movements FOR DELETE
USING (auth.uid() = user_id);

-- ============ Fix other critical tables too ============

-- profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "System can insert profiles" ON public.profiles;

CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update all profiles"
ON public.profiles FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert profiles"
ON public.profiles FOR INSERT
WITH CHECK (true);

-- user_roles
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can read all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Authenticated can read own roles" ON public.user_roles;

CREATE POLICY "Admins can manage roles"
ON public.user_roles FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can read own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

-- assets & analyses (public read)
DROP POLICY IF EXISTS "Anyone can view assets" ON public.assets;
DROP POLICY IF EXISTS "Admins can manage assets" ON public.assets;
CREATE POLICY "Anyone can view assets" ON public.assets FOR SELECT USING (true);
CREATE POLICY "Admins can manage assets" ON public.assets FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Anyone can view analyses" ON public.asset_analyses;
DROP POLICY IF EXISTS "Admins can manage analyses" ON public.asset_analyses;
CREATE POLICY "Anyone can view analyses" ON public.asset_analyses FOR SELECT USING (true);
CREATE POLICY "Admins can manage analyses" ON public.asset_analyses FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- asset_favorites
DROP POLICY IF EXISTS "Users insert own favorites" ON public.asset_favorites;
DROP POLICY IF EXISTS "Users manage own favorites" ON public.asset_favorites;
CREATE POLICY "Users can manage own favorites" ON public.asset_favorites FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own favorites" ON public.asset_favorites FOR INSERT WITH CHECK (auth.uid() = user_id);

-- asset_views
DROP POLICY IF EXISTS "Users insert own views" ON public.asset_views;
DROP POLICY IF EXISTS "Users manage own views" ON public.asset_views;
CREATE POLICY "Users can manage own views" ON public.asset_views FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own views" ON public.asset_views FOR INSERT WITH CHECK (auth.uid() = user_id);

-- subscription_plans
DROP POLICY IF EXISTS "Anyone can view plans" ON public.subscription_plans;
DROP POLICY IF EXISTS "Admins can manage plans" ON public.subscription_plans;
CREATE POLICY "Anyone can view plans" ON public.subscription_plans FOR SELECT USING (true);
CREATE POLICY "Admins can manage plans" ON public.subscription_plans FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- app_config
DROP POLICY IF EXISTS "Admins can manage config" ON public.app_config;
CREATE POLICY "Admins can manage config" ON public.app_config FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can read config" ON public.app_config FOR SELECT USING (true);
