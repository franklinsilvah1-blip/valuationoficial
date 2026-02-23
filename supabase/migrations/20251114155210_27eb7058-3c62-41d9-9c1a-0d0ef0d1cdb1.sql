-- Remover políticas problemáticas do sync_logs
DROP POLICY IF EXISTS "Admins can view all sync logs" ON sync_logs;
DROP POLICY IF EXISTS "Admins can insert sync logs" ON sync_logs;
DROP POLICY IF EXISTS "Admins can update sync logs" ON sync_logs;

-- Criar políticas corretas usando has_role() (SECURITY DEFINER)
CREATE POLICY "Admins can view sync logs" 
ON sync_logs FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert sync logs" 
ON sync_logs FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update sync logs" 
ON sync_logs FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));