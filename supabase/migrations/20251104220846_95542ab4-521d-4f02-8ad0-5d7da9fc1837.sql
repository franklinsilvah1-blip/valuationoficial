-- Add phone field to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS hide_community_message boolean DEFAULT false;

-- Add SMTP configuration table
CREATE TABLE IF NOT EXISTS public.smtp_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  smtp_server text NOT NULL,
  smtp_port integer NOT NULL,
  smtp_user text NOT NULL,
  smtp_password text NOT NULL,
  sender_name text NOT NULL,
  sender_email text NOT NULL,
  security_type text NOT NULL DEFAULT 'TLS',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on smtp_config
ALTER TABLE public.smtp_config ENABLE ROW LEVEL SECURITY;

-- Only admins can manage SMTP config
CREATE POLICY "Admins can manage SMTP config"
ON public.smtp_config
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add community link config table
CREATE TABLE IF NOT EXISTS public.app_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on app_config
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Only admins can manage app config
CREATE POLICY "Admins can manage app config"
ON public.app_config
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default community link
INSERT INTO public.app_config (key, value)
VALUES ('community_whatsapp_link', 'https://chat.whatsapp.com/exemplo')
ON CONFLICT (key) DO NOTHING;

-- Add trigger for updated_at on smtp_config
CREATE TRIGGER update_smtp_config_updated_at
BEFORE UPDATE ON public.smtp_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Add trigger for updated_at on app_config
CREATE TRIGGER update_app_config_updated_at
BEFORE UPDATE ON public.app_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Modify asset_views to track daily limits
-- Add date column to track views per day
ALTER TABLE public.asset_views
ADD COLUMN IF NOT EXISTS view_date date DEFAULT CURRENT_DATE;

-- Create index for faster daily view counting
CREATE INDEX IF NOT EXISTS idx_asset_views_user_date 
ON public.asset_views(user_id, view_date);