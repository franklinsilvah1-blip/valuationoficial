-- Create enum for affiliate status
CREATE TYPE public.affiliate_status AS ENUM ('pending', 'active', 'suspended', 'inactive');

-- Create enum for commission status
CREATE TYPE public.commission_status AS ENUM ('pending', 'approved', 'paid', 'cancelled');

-- Create affiliates table
CREATE TABLE public.affiliates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  affiliate_code TEXT NOT NULL UNIQUE,
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 10.00,
  status public.affiliate_status NOT NULL DEFAULT 'pending',
  total_referrals INTEGER NOT NULL DEFAULT 0,
  total_earnings NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Create referrals table
CREATE TABLE public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'registered',
  converted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(referred_user_id)
);

-- Create commissions table
CREATE TABLE public.commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  referral_id UUID REFERENCES public.referrals(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL,
  status public.commission_status NOT NULL DEFAULT 'pending',
  stripe_payment_id TEXT,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for affiliates table
CREATE POLICY "Affiliates can view own data"
ON public.affiliates FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all affiliates"
ON public.affiliates FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert affiliates"
ON public.affiliates FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update affiliates"
ON public.affiliates FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete affiliates"
ON public.affiliates FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for referrals table
CREATE POLICY "Affiliates can view own referrals"
ON public.referrals FOR SELECT
USING (affiliate_id IN (SELECT id FROM public.affiliates WHERE user_id = auth.uid()));

CREATE POLICY "Admins can view all referrals"
ON public.referrals FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage referrals"
ON public.referrals FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for commissions table
CREATE POLICY "Affiliates can view own commissions"
ON public.commissions FOR SELECT
USING (affiliate_id IN (SELECT id FROM public.affiliates WHERE user_id = auth.uid()));

CREATE POLICY "Admins can view all commissions"
ON public.commissions FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage commissions"
ON public.commissions FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Create function to generate unique affiliate code
CREATE OR REPLACE FUNCTION public.generate_affiliate_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    new_code := upper(substr(md5(random()::text), 1, 8));
    SELECT EXISTS(SELECT 1 FROM public.affiliates WHERE affiliate_code = new_code) INTO code_exists;
    EXIT WHEN NOT code_exists;
  END LOOP;
  RETURN new_code;
END;
$$;

-- Create function to convert user to affiliate
CREATE OR REPLACE FUNCTION public.create_affiliate(target_user_id UUID, custom_code TEXT DEFAULT NULL, custom_rate NUMERIC DEFAULT 10.00)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_affiliate_id UUID;
  final_code TEXT;
BEGIN
  -- Check if user is admin
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can create affiliates';
  END IF;

  -- Check if user already is an affiliate
  IF EXISTS(SELECT 1 FROM public.affiliates WHERE user_id = target_user_id) THEN
    RAISE EXCEPTION 'User is already an affiliate';
  END IF;

  -- Generate or use custom code
  IF custom_code IS NOT NULL THEN
    final_code := upper(custom_code);
  ELSE
    final_code := generate_affiliate_code();
  END IF;

  -- Insert new affiliate
  INSERT INTO public.affiliates (user_id, affiliate_code, commission_rate, status)
  VALUES (target_user_id, final_code, custom_rate, 'active')
  RETURNING id INTO new_affiliate_id;

  RETURN new_affiliate_id;
END;
$$;

-- Create trigger to update updated_at
CREATE TRIGGER update_affiliates_updated_at
BEFORE UPDATE ON public.affiliates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_commissions_updated_at
BEFORE UPDATE ON public.commissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Create indexes for performance
CREATE INDEX idx_affiliates_user_id ON public.affiliates(user_id);
CREATE INDEX idx_affiliates_code ON public.affiliates(affiliate_code);
CREATE INDEX idx_referrals_affiliate_id ON public.referrals(affiliate_id);
CREATE INDEX idx_referrals_referred_user_id ON public.referrals(referred_user_id);
CREATE INDEX idx_commissions_affiliate_id ON public.commissions(affiliate_id);
CREATE INDEX idx_commissions_status ON public.commissions(status);