
-- Fix rate_limit_log: replace overly permissive ALL policy with admin-only access
-- Edge functions use service_role which bypasses RLS anyway
DROP POLICY IF EXISTS "System can manage rate limits" ON public.rate_limit_log;

-- Only admins can view rate limit logs (for dashboard)
CREATE POLICY "Admins can view rate limits"
ON public.rate_limit_log
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Block all client-side writes - only service_role (edge functions) should write
CREATE POLICY "Block client writes on rate limits"
ON public.rate_limit_log
FOR INSERT
TO authenticated, anon
WITH CHECK (false);

CREATE POLICY "Block client updates on rate limits"
ON public.rate_limit_log
FOR UPDATE
TO authenticated, anon
USING (false);

CREATE POLICY "Block client deletes on rate limits"
ON public.rate_limit_log
FOR DELETE
TO authenticated, anon
USING (false);
