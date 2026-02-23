-- Add explicit immutability protection to admin_audit_log
-- Block all UPDATE operations on audit logs
CREATE POLICY "Block audit log modifications"
ON public.admin_audit_log
FOR UPDATE
TO authenticated
USING (false);

-- Block all DELETE operations on audit logs
CREATE POLICY "Block audit log deletions"
ON public.admin_audit_log
FOR DELETE
TO authenticated
USING (false);