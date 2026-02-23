-- Adicionar colunas faltantes na tabela asset_analyses
ALTER TABLE public.asset_analyses
ADD COLUMN IF NOT EXISTS valor NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS multiplicador NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS roi_2023_a_25 NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS dy_25 NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS dy_24 NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS fator_mc NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS roi_24 NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS roi_4t25 NUMERIC(5,2);

COMMENT ON COLUMN public.asset_analyses.valor IS 'Preço do ativo';
COMMENT ON COLUMN public.asset_analyses.multiplicador IS 'Multiplicador';
COMMENT ON COLUMN public.asset_analyses.roi_2023_a_25 IS 'ROI de 2023 a 2025';
COMMENT ON COLUMN public.asset_analyses.dy_25 IS 'Dividend Yield 2025';
COMMENT ON COLUMN public.asset_analyses.dy_24 IS 'Dividend Yield 2024';
COMMENT ON COLUMN public.asset_analyses.fator_mc IS 'Fator MC';
COMMENT ON COLUMN public.asset_analyses.roi_24 IS 'ROI 2024';
COMMENT ON COLUMN public.asset_analyses.roi_4t25 IS 'ROI 4T25 (específico da carteira premium)';