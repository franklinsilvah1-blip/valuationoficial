ALTER TABLE public.wallet_movements 
  ALTER COLUMN valor_por_acao TYPE numeric USING valor_por_acao::numeric;

ALTER TABLE public.wallet_movements 
  ALTER COLUMN quantidade TYPE numeric USING quantidade::numeric;