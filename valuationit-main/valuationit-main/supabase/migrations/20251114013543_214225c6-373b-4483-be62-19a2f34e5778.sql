-- Security fix: Ensure all database functions have fixed search_path
-- This prevents search_path manipulation attacks

-- Update handle_new_user function to ensure proper search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, plan)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.email,
    'FREE'
  );
  RETURN NEW;
END;
$$;

-- Update update_updated_at function to ensure proper search_path
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Update cleanup_old_rate_limits function to ensure proper search_path
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.rate_limit_log
  WHERE window_start < NOW() - INTERVAL '24 hours';
END;
$$;

-- Update create_asset_type_if_not_exists function to ensure proper search_path
CREATE OR REPLACE FUNCTION public.create_asset_type_if_not_exists(type_name text)
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

-- Update reset_community_message_on_plan_change function to ensure proper search_path
CREATE OR REPLACE FUNCTION public.reset_community_message_on_plan_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only reset if plan actually changed and is not FREE
  IF OLD.plan IS DISTINCT FROM NEW.plan AND NEW.plan != 'FREE' THEN
    NEW.hide_community_message = false;
  END IF;
  RETURN NEW;
END;
$$;

-- Update sync_admin_to_specialist function to ensure proper search_path
CREATE OR REPLACE FUNCTION public.sync_admin_to_specialist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

-- Update has_role function to ensure proper search_path (already has it but ensuring consistency)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Update trigger_process_sync_queue function to ensure proper search_path
CREATE OR REPLACE FUNCTION public.trigger_process_sync_queue()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  service_role_key text;
  cron_secret text;
BEGIN
  -- Buscar valores da tabela app_config
  SELECT value INTO service_role_key FROM public.app_config WHERE key = 'service_role_key';
  SELECT value INTO cron_secret FROM public.app_config WHERE key = 'cron_secret';
  
  -- Fazer requisição HTTP
  PERFORM net.http_post(
    url := 'https://yoazkdmzjibogpxkjseh.supabase.co/functions/v1/process-sync-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', concat('Bearer ', service_role_key),
      'x-cron-secret', cron_secret
    ),
    body := '{}'::jsonb
  );
END;
$$;