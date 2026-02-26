
-- Limpar análises duplicadas mantendo apenas a mais recente por asset_id
WITH ranked AS (
  SELECT id, asset_id,
    ROW_NUMBER() OVER (
      PARTITION BY asset_id 
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
    ) AS rn
  FROM public.asset_analyses
)
DELETE FROM public.asset_analyses
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Dropar as duas constraints compostas
ALTER TABLE public.asset_analyses
DROP CONSTRAINT IF EXISTS asset_analyses_asset_carteira_unique;

ALTER TABLE public.asset_analyses
DROP CONSTRAINT IF EXISTS asset_analyses_asset_id_carteira_unique;

-- Criar constraint única apenas por asset_id
ALTER TABLE public.asset_analyses
ADD CONSTRAINT asset_analyses_asset_id_unique UNIQUE (asset_id);
