-- Allow authenticated users to read specific public config keys
CREATE POLICY "Authenticated users can read public config keys"
ON public.app_config
FOR SELECT
TO authenticated
USING (key IN ('community_whatsapp_link'));