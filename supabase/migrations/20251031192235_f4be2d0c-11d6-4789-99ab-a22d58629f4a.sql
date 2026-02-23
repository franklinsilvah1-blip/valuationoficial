-- Fix search_path for create_asset_type_if_not_exists function
CREATE OR REPLACE FUNCTION create_asset_type_if_not_exists(type_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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