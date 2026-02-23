-- Update asset_favorites foreign key to reference profiles instead of auth.users
-- This provides better data model consistency and query capabilities

-- Drop the existing foreign key constraint
ALTER TABLE public.asset_favorites 
DROP CONSTRAINT IF EXISTS asset_favorites_user_id_fkey;

-- Add new foreign key constraint referencing profiles table
ALTER TABLE public.asset_favorites
ADD CONSTRAINT asset_favorites_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES public.profiles(id) 
ON DELETE CASCADE;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_asset_favorites_user_id 
ON public.asset_favorites(user_id);