-- Fix PUBLIC_DATA_EXPOSURE: Remove public read access to app_config
DROP POLICY IF EXISTS "Anyone can read config" ON public.app_config;

-- Fix CLIENT_SIDE_AUTH: Ensure exclusive_videos policy is scoped to authenticated role
DROP POLICY IF EXISTS "Authenticated view videos" ON public.exclusive_videos;
CREATE POLICY "Authenticated view videos" ON public.exclusive_videos FOR SELECT TO authenticated USING (true);