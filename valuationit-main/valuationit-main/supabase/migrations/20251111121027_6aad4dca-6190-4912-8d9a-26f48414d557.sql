-- Renomear coluna roi_4t25 para roitrim na tabela asset_analyses
ALTER TABLE public.asset_analyses 
RENAME COLUMN roi_4t25 TO roitrim;

-- Adicionar comentário para documentar o campo
COMMENT ON COLUMN public.asset_analyses.roitrim IS 'ROI trimestral (4T25) - Retorno sobre investimento do trimestre';