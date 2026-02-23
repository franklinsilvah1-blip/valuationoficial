-- Permitir que usuários não autenticados vejam análises START na página pública
CREATE POLICY "Public can view START analyses"
ON public.asset_analyses
FOR SELECT
USING (carteira = 'START');