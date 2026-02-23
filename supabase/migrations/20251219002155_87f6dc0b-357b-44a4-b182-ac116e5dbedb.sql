-- Atualizar a função request_affiliate_activation para criar afiliados com status 'pending'
CREATE OR REPLACE FUNCTION public.request_affiliate_activation()
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Inserir novo afiliado com status 'pending' (aguardando aprovação manual)
  INSERT INTO public.affiliates (user_id, affiliate_code, commission_rate, status)
  VALUES (auth.uid(), new_code, 10.00, 'pending')
  RETURNING id INTO new_affiliate_id;

  RETURN new_affiliate_id;
END;
$function$;