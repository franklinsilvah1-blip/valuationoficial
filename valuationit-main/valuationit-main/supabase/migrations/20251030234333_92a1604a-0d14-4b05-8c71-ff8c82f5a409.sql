-- Create rate limiting table for endpoint protection
CREATE TABLE IF NOT EXISTS public.rate_limit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  request_count INTEGER DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS on rate_limit_log
ALTER TABLE public.rate_limit_log ENABLE ROW LEVEL SECURITY;

-- Users can only view their own rate limit logs
CREATE POLICY "Users can view own rate limits"
ON public.rate_limit_log
FOR SELECT
USING (auth.uid() = user_id);

-- System can insert rate limit logs (edge functions use service role)
CREATE POLICY "Service role can insert rate limits"
ON public.rate_limit_log
FOR INSERT
WITH CHECK (true);

-- Create index for efficient rate limit queries
CREATE INDEX idx_rate_limit_user_endpoint_window 
ON public.rate_limit_log(user_id, endpoint, window_start);

-- Fix update_updated_at function to set search_path
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Create cleanup function for old rate limit logs (optional maintenance)
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  DELETE FROM public.rate_limit_log
  WHERE window_start < NOW() - INTERVAL '24 hours';
END;
$function$;