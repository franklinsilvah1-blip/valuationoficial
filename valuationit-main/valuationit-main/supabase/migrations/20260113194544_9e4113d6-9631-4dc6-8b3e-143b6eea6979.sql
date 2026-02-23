-- Migrar setor Gold para Metais
UPDATE assets 
SET setor = 'Metais', updated_at = NOW()
WHERE setor = 'Gold';