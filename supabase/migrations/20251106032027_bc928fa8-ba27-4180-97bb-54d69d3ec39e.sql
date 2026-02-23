-- Alterar campo tendencia de ENUM para TEXT para aceitar valores da planilha
-- Como "TAXA NEGATIVA", "AVALIE TAXA/RISCO", "TAXA > SELIC MÊS (1)", etc.
ALTER TABLE asset_analyses 
ALTER COLUMN tendencia TYPE TEXT USING tendencia::TEXT;

-- Drop o ENUM trend que não é mais necessário
DROP TYPE IF EXISTS trend CASCADE;

-- Resetar fila de sincronização para reprocessar todos os registros
-- Isso vai repopular os campos tendencia com os valores corretos da planilha
UPDATE sync_queue 
SET status = 'PENDING', 
    attempts = 0,
    error_message = NULL,
    processed_at = NULL
WHERE status = 'COMPLETED';