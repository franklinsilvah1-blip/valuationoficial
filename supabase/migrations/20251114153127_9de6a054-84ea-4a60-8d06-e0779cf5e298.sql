-- Remover política RLS antiga que causa erro 406
DROP POLICY IF EXISTS "Admins can view all sync logs" ON sync_logs;

-- Criar novas políticas RLS que verificam JWT diretamente (não dependem de auth.uid() estar pronto)
CREATE POLICY "Admins can view all sync logs" 
ON sync_logs 
FOR SELECT 
USING (
  auth.jwt() ->> 'email' IN (
    SELECT email FROM profiles WHERE id IN (
      SELECT user_id FROM user_roles WHERE role = 'admin'
    )
  )
);

-- Permitir admins inserirem logs
CREATE POLICY "Admins can insert sync logs" 
ON sync_logs 
FOR INSERT 
WITH CHECK (
  auth.jwt() ->> 'email' IN (
    SELECT email FROM profiles WHERE id IN (
      SELECT user_id FROM user_roles WHERE role = 'admin'
    )
  )
);

-- Permitir admins atualizarem logs
CREATE POLICY "Admins can update sync logs" 
ON sync_logs 
FOR UPDATE 
USING (
  auth.jwt() ->> 'email' IN (
    SELECT email FROM profiles WHERE id IN (
      SELECT user_id FROM user_roles WHERE role = 'admin'
    )
  )
);