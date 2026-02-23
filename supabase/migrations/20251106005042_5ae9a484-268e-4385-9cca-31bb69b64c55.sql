-- Tabela para registrar histórico de sincronizações
CREATE TABLE IF NOT EXISTS sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type TEXT NOT NULL CHECK (sync_type IN ('google_sheets', 'csv_free', 'csv_premium')),
  status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'PARTIAL', 'FAILED', 'IN_PROGRESS')),
  inserted INTEGER DEFAULT 0,
  updated INTEGER DEFAULT 0,
  failed INTEGER DEFAULT 0,
  skipped INTEGER DEFAULT 0,
  total_rows INTEGER DEFAULT 0,
  errors JSONB,
  warnings JSONB,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  triggered_by UUID REFERENCES auth.users(id),
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('manual', 'automatic')),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_sync_logs_created_at ON sync_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_logs_status ON sync_logs(status);
CREATE INDEX IF NOT EXISTS idx_sync_logs_type ON sync_logs(sync_type);

-- RLS Policies
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all sync logs"
  ON sync_logs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Comentários para documentação
COMMENT ON TABLE sync_logs IS 'Registra histórico de todas as sincronizações de dados (Google Sheets e CSV)';
COMMENT ON COLUMN sync_logs.sync_type IS 'Tipo de sincronização: google_sheets, csv_free, csv_premium';
COMMENT ON COLUMN sync_logs.trigger_type IS 'Como a sync foi iniciada: manual (via admin) ou automatic (cron job)';
COMMENT ON COLUMN sync_logs.metadata IS 'Informações adicionais como número de chunks processados, tempo de execução, etc';