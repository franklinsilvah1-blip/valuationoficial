
-- Function to get all public table names for dynamic backup
CREATE OR REPLACE FUNCTION public.get_all_table_names()
RETURNS TABLE(table_name text)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT tablename::text as table_name
  FROM pg_tables
  WHERE schemaname = 'public'
  ORDER BY tablename;
$$;
