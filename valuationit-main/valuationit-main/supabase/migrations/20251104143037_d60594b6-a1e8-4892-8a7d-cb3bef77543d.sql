-- Fix: Add plan expiration check to asset_analyses RLS policy
-- This prevents users with expired subscriptions from accessing premium content

-- Drop existing policy
DROP POLICY IF EXISTS "Authenticated users can view analyses matching their plan" ON public.asset_analyses;

-- Recreate policy with expiration check
CREATE POLICY "Authenticated users can view analyses matching their plan"
  ON public.asset_analyses
  FOR SELECT
  TO authenticated
  USING (
    -- START content is always accessible
    carteira = 'START' OR
    -- PRO content requires active PRO or SPECIALIST plan
    (carteira = 'PRO' AND EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND plan IN ('PRO', 'SPECIALIST')
      AND (plan_end_at IS NULL OR plan_end_at > NOW())
    )) OR
    -- SPECIALIST content requires active SPECIALIST plan
    (carteira = 'SPECIALIST' AND EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND plan = 'SPECIALIST'
      AND (plan_end_at IS NULL OR plan_end_at > NOW())
    ))
  );