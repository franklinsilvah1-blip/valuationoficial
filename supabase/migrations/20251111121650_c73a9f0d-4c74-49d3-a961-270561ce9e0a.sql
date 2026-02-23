-- Padronização de nomenclatura dos campos ROI e DY
-- Opção C: Renomear roi25 para roi25simple e roi_25 para roi2025

-- 1. Renomear roi25 para roi25simple
ALTER TABLE public.asset_analyses 
RENAME COLUMN roi25 TO roi25simple;

COMMENT ON COLUMN public.asset_analyses.roi25simple IS 'ROI 25 simplificado (coluna ROI25 da planilha)';

-- 2. Renomear roi_25 para roi2025
ALTER TABLE public.asset_analyses 
RENAME COLUMN roi_25 TO roi2025;

COMMENT ON COLUMN public.asset_analyses.roi2025 IS 'ROI 2025 completo (coluna ROI 2025 da planilha)';

-- 3. Renomear roi_24 para roi2024
ALTER TABLE public.asset_analyses 
RENAME COLUMN roi_24 TO roi2024;

COMMENT ON COLUMN public.asset_analyses.roi2024 IS 'ROI 2024';

-- 4. Renomear dy_24 para dy2024
ALTER TABLE public.asset_analyses 
RENAME COLUMN dy_24 TO dy2024;

COMMENT ON COLUMN public.asset_analyses.dy2024 IS 'Dividend Yield 2024';

-- 5. Renomear dy_25 para dy2025
ALTER TABLE public.asset_analyses 
RENAME COLUMN dy_25 TO dy2025;

COMMENT ON COLUMN public.asset_analyses.dy2025 IS 'Dividend Yield 2025';

-- 6. Renomear roi_2023_a_25 para roi2023a2025
ALTER TABLE public.asset_analyses 
RENAME COLUMN roi_2023_a_25 TO roi2023a2025;

COMMENT ON COLUMN public.asset_analyses.roi2023a2025 IS 'ROI acumulado de 2023 a 2025';