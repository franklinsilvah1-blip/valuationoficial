-- Criar função para limpar sync_logs órfãos automaticamente
CREATE OR REPLACE FUNCTION public.cleanup_orphaned_syncs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Marcar syncs órfãos (IN_PROGRESS há mais de 10 minutos)
  UPDATE sync_logs
  SET 
    status = 'FAILED',
    completed_at = NOW(),
    metadata = COALESCE(metadata, '{}'::jsonb) || 
               jsonb_build_object(
                 'cleanup_reason', 'auto_cleanup_orphaned',
                 'cleaned_at', NOW()::text
               )
  WHERE status = 'IN_PROGRESS'
    AND started_at < NOW() - INTERVAL '10 minutes';
    
  RAISE LOG 'Cleaned up orphaned sync logs';
END;
$$;