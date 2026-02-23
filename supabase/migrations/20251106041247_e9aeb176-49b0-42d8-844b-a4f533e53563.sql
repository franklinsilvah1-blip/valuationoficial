-- Atualizar política RLS para usuários autenticados verem análises do seu plano
-- Sem verificar plan_end_at (fonte única: profiles.plan)
DROP POLICY IF EXISTS "Authenticated users can view analyses matching their plan" ON public.asset_analyses;

CREATE POLICY "Authenticated users can view analyses matching their plan"
ON public.asset_analyses
FOR SELECT
USING (
  -- START: todos autenticados veem
  (carteira = 'START') OR
  
  -- PRO: usuários PRO ou SPECIALIST veem
  (carteira = 'PRO' AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.plan IN ('PRO', 'SPECIALIST')
  )) OR
  
  -- SPECIALIST: apenas usuários SPECIALIST veem
  (carteira = 'SPECIALIST' AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.plan = 'SPECIALIST'
  ))
);