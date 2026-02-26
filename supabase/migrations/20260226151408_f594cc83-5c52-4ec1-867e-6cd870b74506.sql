
-- Step 1: Clean any empty string codigo_b3 (safety)
UPDATE public.assets SET codigo_b3 = NULL WHERE codigo_b3 = '';

-- Step 2: Delete assets with NULL codigo_b3 (if any)
DELETE FROM public.assets WHERE codigo_b3 IS NULL;

-- Step 3: Set NOT NULL constraint
ALTER TABLE public.assets ALTER COLUMN codigo_b3 SET NOT NULL;

-- Step 4: Add UNIQUE constraint for upsert support
ALTER TABLE public.assets ADD CONSTRAINT assets_codigo_b3_unique UNIQUE (codigo_b3);

-- Step 5: Add unique constraint on asset_analyses for (asset_id, carteira) upsert
-- First check if it exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'asset_analyses_asset_id_carteira_unique'
  ) THEN
    ALTER TABLE public.asset_analyses ADD CONSTRAINT asset_analyses_asset_id_carteira_unique UNIQUE (asset_id, carteira);
  END IF;
END $$;
