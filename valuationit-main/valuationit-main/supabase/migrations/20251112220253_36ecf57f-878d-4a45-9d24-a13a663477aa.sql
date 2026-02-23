
-- Habilitar Realtime para sync_logs (atualizações instantâneas de histórico)
ALTER PUBLICATION supabase_realtime ADD TABLE sync_logs;

-- Habilitar Realtime para sync_queue (atualizações instantâneas da fila)
ALTER PUBLICATION supabase_realtime ADD TABLE sync_queue;
