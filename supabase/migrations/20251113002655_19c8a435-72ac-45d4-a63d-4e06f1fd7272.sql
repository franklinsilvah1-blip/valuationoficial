-- CRITICAL SECURITY: Add explicit denial policies to user_roles table
-- This prevents privilege escalation attacks by blocking all direct write operations
-- Only edge functions with service role can manage user roles

-- Drop any existing permissive policies (if any exist)
DROP POLICY IF EXISTS "Users can insert own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can update own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can delete own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

-- Add explicit DENY policies for all write operations
-- These policies return false, blocking ALL attempts to INSERT/UPDATE/DELETE
CREATE POLICY "Block all direct inserts on user_roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (false);

CREATE POLICY "Block all direct updates on user_roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (false);

CREATE POLICY "Block all direct deletes on user_roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (false);

-- Note: The existing SELECT policies remain unchanged:
-- - "Admins can view all roles" - allows admins to see all user roles
-- - "Users can view own roles" - allows users to see their own roles
-- Edge functions using service_role key can still manage roles as they bypass RLS