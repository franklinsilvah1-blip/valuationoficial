ALTER TABLE public.wallet_items
  ALTER COLUMN quantidade TYPE numeric USING quantidade::numeric;