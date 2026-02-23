-- Create subscription_plans table for centralized plan management
CREATE TABLE public.subscription_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_code text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  price_quarterly numeric NOT NULL DEFAULT 0,
  price_note text,
  stripe_price_id text,
  features jsonb DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

-- Public can read active plans
CREATE POLICY "Anyone can view active plans" 
ON public.subscription_plans 
FOR SELECT 
USING (is_active = true);

-- Admins can manage all plans
CREATE POLICY "Admins can manage plans" 
ON public.subscription_plans 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_subscription_plans_updated_at
BEFORE UPDATE ON public.subscription_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Insert default plans
INSERT INTO public.subscription_plans (plan_code, display_name, description, price_quarterly, price_note, stripe_price_id, features, sort_order) VALUES
('START', 'Carteira Start', 'Ideal para quem está começando', 149.90, 'Cobrado trimestralmente (R$ 49,97/mês)', 'price_1RKlWJJhvHOJ4YFGiSjgKPZT', '["Acesso à carteira START", "Análises básicas de FIIs", "5 visualizações por dia", "Suporte por email"]', 1),
('PRO', 'Carteira Pro', 'Para investidores intermediários', 249.90, 'Cobrado trimestralmente (R$ 83,30/mês)', 'price_1RKla4JhvHOJ4YFG4BO95WR8', '["Acesso às carteiras START e PRO", "Análises completas", "Visualizações ilimitadas", "Simulador de carteira", "Suporte prioritário"]', 2),
('SPECIALIST', 'Carteira Specialist', 'Experiência completa premium', 599.90, 'Cobrado trimestralmente (R$ 199,97/mês)', 'price_1RKlbTJhvHOJ4YFGMW0NqyG9', '["Acesso a TODAS as carteiras", "Análises exclusivas", "Visualizações ilimitadas", "Comunidade VIP no WhatsApp", "Suporte VIP dedicado", "Acesso antecipado a novidades"]', 3);