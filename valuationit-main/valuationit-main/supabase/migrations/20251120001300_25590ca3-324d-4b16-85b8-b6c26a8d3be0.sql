-- Add user preferences columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS theme_preference TEXT DEFAULT 'light' CHECK (theme_preference IN ('light', 'dark')),
ADD COLUMN IF NOT EXISTS sidebar_collapsed BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.profiles.theme_preference IS 'User theme preference: light or dark';
COMMENT ON COLUMN public.profiles.sidebar_collapsed IS 'User sidebar state: collapsed or expanded';