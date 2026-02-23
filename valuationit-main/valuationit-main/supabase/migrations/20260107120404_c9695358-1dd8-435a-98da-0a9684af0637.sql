-- Fix overly permissive RLS policies for service role operations
-- These tables are managed by edge functions using the service role
-- but the policies should be more restrictive for regular users

-- 1. admin_audit_log: Only the service role should be able to insert
DROP POLICY IF EXISTS "Service role can insert audit logs" ON public.admin_audit_log;

-- Create a more restrictive policy - deny all client-side inserts
-- Edge functions use service_role which bypasses RLS anyway
CREATE POLICY "Block all direct inserts on audit logs"
ON public.admin_audit_log
FOR INSERT
TO authenticated
WITH CHECK (false);

-- 2. affiliate_clicks: Only edge functions should insert
DROP POLICY IF EXISTS "Service role can insert clicks" ON public.affiliate_clicks;

-- Block client-side inserts - edge functions bypass RLS with service_role
CREATE POLICY "Block all direct inserts on affiliate clicks"
ON public.affiliate_clicks
FOR INSERT
TO authenticated
WITH CHECK (false);

-- 3. rate_limit_log: Only edge functions should insert
DROP POLICY IF EXISTS "Service role can insert rate limits" ON public.rate_limit_log;

-- Block client-side inserts - edge functions bypass RLS with service_role
CREATE POLICY "Block all direct inserts on rate limit log"
ON public.rate_limit_log
FOR INSERT
TO authenticated
WITH CHECK (false);

-- 4. sync_queue: Only service role operations
DROP POLICY IF EXISTS "Service role can manage sync queue" ON public.sync_queue;

-- Block all client-side operations - only service role should manage
CREATE POLICY "Block direct inserts on sync queue"
ON public.sync_queue
FOR INSERT
TO authenticated
WITH CHECK (false);

CREATE POLICY "Block direct updates on sync queue"
ON public.sync_queue
FOR UPDATE
TO authenticated
USING (false);

CREATE POLICY "Block direct deletes on sync queue"
ON public.sync_queue
FOR DELETE
TO authenticated
USING (false);

-- 5. tracking_events: Only edge functions should insert
DROP POLICY IF EXISTS "Service role can insert tracking events" ON public.tracking_events;

-- Block client-side inserts - edge functions bypass RLS with service_role
CREATE POLICY "Block all direct inserts on tracking events"
ON public.tracking_events
FOR INSERT
TO authenticated
WITH CHECK (false);