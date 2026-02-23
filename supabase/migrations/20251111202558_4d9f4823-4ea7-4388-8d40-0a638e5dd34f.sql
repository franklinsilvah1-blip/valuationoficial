-- Create table for tracking scripts and pixels
CREATE TABLE IF NOT EXISTS public.tracking_scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('google_analytics', 'google_tag_manager', 'google_ads', 'facebook_pixel', 'custom')),
  script_id TEXT,
  script_content TEXT,
  location TEXT NOT NULL CHECK (location IN ('head', 'body_start', 'body_end')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Enable RLS
ALTER TABLE public.tracking_scripts ENABLE ROW LEVEL SECURITY;

-- Admins can manage tracking scripts
CREATE POLICY "Admins can manage tracking scripts"
  ON public.tracking_scripts
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create updated_at trigger
CREATE TRIGGER update_tracking_scripts_updated_at
  BEFORE UPDATE ON public.tracking_scripts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Add comment
COMMENT ON TABLE public.tracking_scripts IS 'Stores tracking scripts and pixels for Google Analytics, GTM, Ads, etc.';