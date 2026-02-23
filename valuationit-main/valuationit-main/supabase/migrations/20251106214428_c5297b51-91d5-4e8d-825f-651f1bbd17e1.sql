-- Step 1: Update asset_type enum (rename INDICES to INDICE, remove REIT)
-- First convert column to text
ALTER TABLE assets ALTER COLUMN tipo TYPE text;

-- Update existing data
UPDATE assets SET tipo = 'INDICE' WHERE tipo = 'INDICES';

-- Drop old enum and create new one
DROP TYPE IF EXISTS asset_type;
CREATE TYPE asset_type AS ENUM ('ACAO', 'BDR', 'CRYPTO', 'ETF', 'FII', 'INDICE');

-- Convert back to enum
ALTER TABLE assets 
  ALTER COLUMN tipo TYPE asset_type 
  USING tipo::asset_type;

-- Step 2: Update recommendation enum with new values
-- First convert to text to preserve data
ALTER TABLE asset_analyses 
  ALTER COLUMN recomendacao TYPE text;

-- Drop old enum and create new one
DROP TYPE IF EXISTS recommendation;
CREATE TYPE recommendation AS ENUM (
  'COMPRA (DY)',
  'COMPRA (RA)', 
  'COMPRA (RB)',
  'COMPRA (RM)',
  'Ñ COMPRA (ATF)',
  'NEUTRA (AF)',
  'NEUTRA (TF)'
);

-- Map old values to new ones
UPDATE asset_analyses
SET recomendacao = CASE 
  WHEN recomendacao = 'COMPRAR' THEN 'COMPRA (RA)'
  WHEN recomendacao = 'MANTER' THEN 'NEUTRA (AF)'
  WHEN recomendacao = 'VENDER' THEN 'Ñ COMPRA (ATF)'
  ELSE NULL
END;

-- Convert back to enum
ALTER TABLE asset_analyses 
  ALTER COLUMN recomendacao TYPE recommendation 
  USING recomendacao::recommendation;

-- Step 3: Convert tendencia to text field (if it's still an enum)
ALTER TABLE asset_analyses 
  ALTER COLUMN tendencia TYPE text;