
-- Gerar UUIDs para registros que não têm id
UPDATE wallet_movements SET id = gen_random_uuid() WHERE id IS NULL;

-- Gerar timestamps para registros sem created_at
UPDATE wallet_movements SET created_at = now()::text WHERE created_at IS NULL;

-- Adicionar DEFAULT e NOT NULL na coluna id
ALTER TABLE wallet_movements 
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN id SET NOT NULL;

-- Adicionar PRIMARY KEY
ALTER TABLE wallet_movements ADD PRIMARY KEY (id);

-- Garantir NOT NULL nas colunas obrigatórias
ALTER TABLE wallet_movements ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE wallet_movements ALTER COLUMN codigo_b3 SET NOT NULL;
ALTER TABLE wallet_movements ALTER COLUMN tipo_operacao SET NOT NULL;
ALTER TABLE wallet_movements ALTER COLUMN valor_por_acao SET NOT NULL;
ALTER TABLE wallet_movements ALTER COLUMN quantidade SET NOT NULL;
ALTER TABLE wallet_movements ALTER COLUMN data_operacao SET NOT NULL;
ALTER TABLE wallet_movements ALTER COLUMN created_at SET DEFAULT now()::text;

-- Recriar índices de performance
CREATE INDEX IF NOT EXISTS idx_wallet_movements_user_id ON wallet_movements(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_movements_data_operacao ON wallet_movements(data_operacao);
