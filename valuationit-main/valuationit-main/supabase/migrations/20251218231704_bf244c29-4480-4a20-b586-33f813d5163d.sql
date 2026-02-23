-- 1. Corrigir RLS em referrals: permitir INSERT quando referred_user_id = auth.uid()
DROP POLICY IF EXISTS "Users can insert own referral" ON public.referrals;

CREATE POLICY "Users can insert own referral" 
ON public.referrals 
FOR INSERT 
TO authenticated
WITH CHECK (referred_user_id = auth.uid());

-- 2. Criar função request_affiliate_activation para auto-ativação (qualquer usuário logado)
CREATE OR REPLACE FUNCTION public.request_affiliate_activation()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_affiliate_id UUID;
  new_code TEXT;
BEGIN
  -- Verificar se usuário está autenticado
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;

  -- Verificar se já é afiliado
  IF EXISTS(SELECT 1 FROM public.affiliates WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'User is already an affiliate';
  END IF;

  -- Gerar código único
  new_code := generate_affiliate_code();

  -- Inserir novo afiliado com status 'active'
  INSERT INTO public.affiliates (user_id, affiliate_code, commission_rate, status)
  VALUES (auth.uid(), new_code, 10.00, 'active')
  RETURNING id INTO new_affiliate_id;

  RETURN new_affiliate_id;
END;
$$;