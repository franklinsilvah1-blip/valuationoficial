-- Função que atualiza o plano quando admin é atribuído
CREATE OR REPLACE FUNCTION public.sync_admin_to_specialist()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Apenas quando inserir role 'admin'
  IF NEW.role = 'admin' THEN
    UPDATE public.profiles
    SET 
      plan = 'SPECIALIST',
      plan_start_at = NOW(),
      plan_end_at = NULL
    WHERE id = NEW.user_id;
    
    RAISE LOG 'Admin role granted: Updated user % to SPECIALIST plan', NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger que dispara após inserir role
CREATE TRIGGER on_admin_role_assigned
  AFTER INSERT ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_admin_to_specialist();