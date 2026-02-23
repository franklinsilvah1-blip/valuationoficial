-- Create enum for operation types
CREATE TYPE operation_type AS ENUM (
  'COMPRA',
  'VENDA', 
  'GANHOS_JCP',
  'GANHOS_RC',
  'GANHOS_DY',
  'GANHOS_BA'
);

-- Create wallet_movements table
CREATE TABLE public.wallet_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES assets(id),
  codigo_b3 TEXT NOT NULL,
  tipo_operacao operation_type NOT NULL,
  valor_por_acao NUMERIC(15,2) NOT NULL,
  quantidade INTEGER NOT NULL,
  data_operacao DATE NOT NULL DEFAULT CURRENT_DATE,
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.wallet_movements ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own movements"
ON public.wallet_movements
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own movements"
ON public.wallet_movements
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own movements"
ON public.wallet_movements
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own movements"
ON public.wallet_movements
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for performance
CREATE INDEX idx_wallet_movements_user_id ON public.wallet_movements(user_id);
CREATE INDEX idx_wallet_movements_data_operacao ON public.wallet_movements(data_operacao);