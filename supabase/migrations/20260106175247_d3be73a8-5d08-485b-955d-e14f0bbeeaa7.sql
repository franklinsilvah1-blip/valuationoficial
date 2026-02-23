-- Alterar user_id para nullable
ALTER TABLE push_subscriptions ALTER COLUMN user_id DROP NOT NULL;

-- Adicionar device_id para identificar visitantes anônimos
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS device_id TEXT;

-- Criar índice para busca por device_id
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_device_id ON push_subscriptions(device_id);

-- Criar índice para buscas de anônimos ativos
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_anonymous_active 
ON push_subscriptions(is_active) WHERE user_id IS NULL;

-- Política para permitir inserção anônima via edge function (service role)
-- A edge function usará service role, então não precisa de política específica para anon