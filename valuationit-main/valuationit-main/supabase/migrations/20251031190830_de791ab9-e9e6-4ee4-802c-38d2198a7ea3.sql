-- Add CRYPTO type to asset_type enum
ALTER TYPE asset_type ADD VALUE IF NOT EXISTS 'CRYPTO';

-- Add skipped column to import_jobs for tracking skipped rows
ALTER TABLE import_jobs ADD COLUMN IF NOT EXISTS skipped integer DEFAULT 0;

-- Create function to dynamically add asset types (for future use)
CREATE OR REPLACE FUNCTION create_asset_type_if_not_exists(type_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Note: Dynamic enum addition requires careful handling
  -- For now, this function serves as a placeholder for future enhancement
  -- Actual dynamic enum modification would require more complex logic
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$;