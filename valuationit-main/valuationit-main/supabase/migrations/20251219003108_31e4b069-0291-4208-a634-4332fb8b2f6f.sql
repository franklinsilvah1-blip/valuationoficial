-- Add rejection reason column to affiliates table
ALTER TABLE public.affiliates 
ADD COLUMN IF NOT EXISTS rejection_reason TEXT DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.affiliates.rejection_reason IS 'Motivo informado pelo admin ao rejeitar/suspender o afiliado';