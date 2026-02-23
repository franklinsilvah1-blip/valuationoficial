-- Limpar dados duplicados antes de adicionar constraint única
-- Manter apenas uma análise por ativo, priorizando: FALE_C_ESPECIALISTA > SPECIALIST > PRO > START

-- Primeiro, identificar e deletar duplicatas
WITH ranked_analyses AS (
  SELECT 
    id,
    asset_id,
    ROW_NUMBER() OVER (
      PARTITION BY asset_id 
      ORDER BY 
        CASE carteira
          WHEN 'FALE_C_ESPECIALISTA' THEN 1
          WHEN 'SPECIALIST' THEN 2
          WHEN 'PRO' THEN 3
          WHEN 'START' THEN 4
          ELSE 5
        END,
        created_at DESC
    ) as rn
  FROM public.asset_analyses
)
DELETE FROM public.asset_analyses
WHERE id IN (
  SELECT id FROM ranked_analyses WHERE rn > 1
);

-- Adicionar coluna roi_25 se não existir
ALTER TABLE public.asset_analyses
ADD COLUMN IF NOT EXISTS roi_25 numeric;

-- Remover coluna multiplicador se ainda existir
ALTER TABLE public.asset_analyses
DROP COLUMN IF EXISTS multiplicador;

-- Remover constraint antiga
ALTER TABLE public.asset_analyses
DROP CONSTRAINT IF EXISTS asset_analyses_asset_id_carteira_key;

-- Adicionar constraint única por asset_id
ALTER TABLE public.asset_analyses
ADD CONSTRAINT asset_analyses_asset_id_unique UNIQUE (asset_id);

-- Atualizar RLS policies
DROP POLICY IF EXISTS "Authenticated users can view analyses matching their plan" ON public.asset_analyses;
DROP POLICY IF EXISTS "Public can view START analyses" ON public.asset_analyses;
DROP POLICY IF EXISTS "Authenticated users can view all analyses" ON public.asset_analyses;
DROP POLICY IF EXISTS "Public can view basic analyses" ON public.asset_analyses;

CREATE POLICY "Authenticated users can view all analyses"
ON public.asset_analyses FOR SELECT TO authenticated USING (true);

CREATE POLICY "Public can view basic analyses"
ON public.asset_analyses FOR SELECT TO anon USING (true);

-- Comentários
COMMENT ON COLUMN public.asset_analyses.carteira IS 'Valor da coluna CARTEIRA CLUB da planilha';
COMMENT ON COLUMN public.asset_analyses.roi_25 IS 'ROI 25 da planilha';
COMMENT ON COLUMN public.asset_analyses.fator_mc IS 'FATOR MC da planilha';