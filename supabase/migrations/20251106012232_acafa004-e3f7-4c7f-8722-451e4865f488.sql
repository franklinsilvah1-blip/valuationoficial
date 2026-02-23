-- Fix security issues: Add audit logging for admin role assignments

-- Create audit log table for tracking privilege escalations
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  granted_by uuid REFERENCES auth.users(id),
  action text NOT NULL,
  old_plan plan_type,
  new_plan plan_type,
  role_assigned app_role,
  metadata jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs"
ON public.admin_audit_log
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Service role can insert audit logs
CREATE POLICY "Service role can insert audit logs"
ON public.admin_audit_log
FOR INSERT
WITH CHECK (true);

-- Update the sync_admin_to_specialist function to include audit logging
CREATE OR REPLACE FUNCTION public.sync_admin_to_specialist()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_plan_value plan_type;
BEGIN
  -- Only when inserting role 'admin'
  IF NEW.role = 'admin' THEN
    -- Get current plan before update
    SELECT plan INTO old_plan_value
    FROM public.profiles
    WHERE id = NEW.user_id;
    
    -- Update user to SPECIALIST plan
    UPDATE public.profiles
    SET 
      plan = 'SPECIALIST',
      plan_start_at = NOW(),
      plan_end_at = NULL
    WHERE id = NEW.user_id;
    
    -- Insert audit log
    INSERT INTO public.admin_audit_log (
      user_id,
      action,
      old_plan,
      new_plan,
      role_assigned,
      metadata
    ) VALUES (
      NEW.user_id,
      'admin_role_granted_auto_specialist',
      old_plan_value,
      'SPECIALIST',
      'admin',
      jsonb_build_object(
        'trigger', 'on_admin_role_assigned',
        'timestamp', NOW()
      )
    );
    
    RAISE LOG 'Admin role granted: Updated user % from % to SPECIALIST plan (audit logged)', NEW.user_id, old_plan_value;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Move uuid-ossp extension to extensions schema (best practice)
CREATE SCHEMA IF NOT EXISTS extensions;
-- Note: Extension movement requires manual intervention as it may affect existing references
-- This is documented for manual review and implementation during maintenance window