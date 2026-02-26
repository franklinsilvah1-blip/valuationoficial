
-- Add primary key to asset_analyses (id column exists but has no PK constraint)
-- First set default for id where null
UPDATE public.asset_analyses SET id = gen_random_uuid() WHERE id IS NULL;

-- Make id NOT NULL
ALTER TABLE public.asset_analyses ALTER COLUMN id SET NOT NULL;
ALTER TABLE public.asset_analyses ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Add primary key
ALTER TABLE public.asset_analyses ADD PRIMARY KEY (id);

-- Make conflict columns NOT NULL for proper ON CONFLICT behavior
ALTER TABLE public.asset_analyses ALTER COLUMN asset_id SET NOT NULL;
ALTER TABLE public.asset_analyses ALTER COLUMN carteira SET NOT NULL;
