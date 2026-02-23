-- Tabela principal do simulador
CREATE TABLE wallet_simulator (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Tabela de itens da carteira
CREATE TABLE wallet_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES wallet_simulator(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  quantidade INTEGER NOT NULL CHECK (quantidade > 0),
  preco_compra NUMERIC(10,2) NOT NULL CHECK (preco_compra > 0),
  aporte_adicional NUMERIC(10,2) DEFAULT 0,
  data_compra DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(wallet_id, asset_id)
);

-- RLS Policies
ALTER TABLE wallet_simulator ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_items ENABLE ROW LEVEL SECURITY;

-- Users can only see their own wallet
CREATE POLICY "Users can view own wallet"
  ON wallet_simulator FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own wallet"
  ON wallet_simulator FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own wallet"
  ON wallet_simulator FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can only manage their own wallet items
CREATE POLICY "Users can view own wallet items"
  ON wallet_items FOR SELECT
  USING (wallet_id IN (
    SELECT id FROM wallet_simulator WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can insert own wallet items"
  ON wallet_items FOR INSERT
  WITH CHECK (wallet_id IN (
    SELECT id FROM wallet_simulator WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can update own wallet items"
  ON wallet_items FOR UPDATE
  USING (wallet_id IN (
    SELECT id FROM wallet_simulator WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can delete own wallet items"
  ON wallet_items FOR DELETE
  USING (wallet_id IN (
    SELECT id FROM wallet_simulator WHERE user_id = auth.uid()
  ));

-- Trigger para updated_at
CREATE TRIGGER update_wallet_simulator_updated_at
  BEFORE UPDATE ON wallet_simulator
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_wallet_items_updated_at
  BEFORE UPDATE ON wallet_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();