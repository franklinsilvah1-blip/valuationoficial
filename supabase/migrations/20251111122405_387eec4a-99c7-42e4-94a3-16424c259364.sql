-- Remover campos ROI que não existem na planilha
-- Mantendo apenas: roitrim, roi2025, roi2024, roi2023a2025

-- Remover campo roi genérico
ALTER TABLE public.asset_analyses 
DROP COLUMN IF EXISTS roi;

-- Remover campo roi25simple (anteriormente roi25)
ALTER TABLE public.asset_analyses 
DROP COLUMN IF EXISTS roi25simple;

COMMENT ON TABLE public.asset_analyses IS 'Campos ROI alinhados com a planilha: roitrim, roi2025, roi2024, roi2023a2025';