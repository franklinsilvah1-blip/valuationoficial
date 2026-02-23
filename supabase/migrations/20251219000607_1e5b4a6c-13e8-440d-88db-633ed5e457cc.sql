-- Create affiliate_clicks table for tracking link clicks
CREATE TABLE public.affiliate_clicks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  affiliate_code TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  referrer TEXT,
  landing_page TEXT,
  session_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_affiliate_clicks_affiliate_id ON public.affiliate_clicks(affiliate_id);
CREATE INDEX idx_affiliate_clicks_created_at ON public.affiliate_clicks(created_at DESC);
CREATE INDEX idx_affiliate_clicks_affiliate_code ON public.affiliate_clicks(affiliate_code);

-- Enable RLS
ALTER TABLE public.affiliate_clicks ENABLE ROW LEVEL SECURITY;

-- Policies for affiliate_clicks
CREATE POLICY "Admins can view all clicks" 
ON public.affiliate_clicks 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Affiliates can view own clicks" 
ON public.affiliate_clicks 
FOR SELECT 
USING (affiliate_id IN (
  SELECT id FROM public.affiliates WHERE user_id = auth.uid()
));

CREATE POLICY "Service role can insert clicks" 
ON public.affiliate_clicks 
FOR INSERT 
WITH CHECK (true);

-- Add comment
COMMENT ON TABLE public.affiliate_clicks IS 'Tracks clicks on affiliate referral links';