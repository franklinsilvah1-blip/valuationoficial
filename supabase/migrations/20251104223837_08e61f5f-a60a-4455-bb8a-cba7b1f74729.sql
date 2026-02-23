-- Create trigger to reset hide_community_message when plan changes
CREATE OR REPLACE FUNCTION public.reset_community_message_on_plan_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only reset if plan actually changed and is not FREE
  IF OLD.plan IS DISTINCT FROM NEW.plan AND NEW.plan != 'FREE' THEN
    NEW.hide_community_message = false;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger that fires before update on profiles table
DROP TRIGGER IF EXISTS reset_community_banner_on_plan_change ON public.profiles;
CREATE TRIGGER reset_community_banner_on_plan_change
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  WHEN (OLD.plan IS DISTINCT FROM NEW.plan)
  EXECUTE FUNCTION public.reset_community_message_on_plan_change();