-- Add is_active field to assets table to track active assets from spreadsheet
ALTER TABLE public.assets 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Create index for better performance on is_active queries
CREATE INDEX IF NOT EXISTS idx_assets_is_active ON public.assets(is_active);

-- Add comment explaining the field
COMMENT ON COLUMN public.assets.is_active IS 'Indicates if asset is currently in the Google Sheets spreadsheet. Updated during sync process.';