-- Adicionar coluna proventos na tabela wallet_items
ALTER TABLE public.wallet_items ADD COLUMN IF NOT EXISTS proventos numeric DEFAULT 0;