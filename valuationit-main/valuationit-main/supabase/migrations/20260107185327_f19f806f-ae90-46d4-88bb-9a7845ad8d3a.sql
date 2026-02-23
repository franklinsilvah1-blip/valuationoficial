-- Migrar valores antigos de tendencia para novos valores simplificados
UPDATE asset_analyses 
SET tendencia = 'ALTA' 
WHERE tendencia = 'ALTA (ROI > TR)';

UPDATE asset_analyses 
SET tendencia = 'NEUTRA' 
WHERE tendencia = 'NEUTRA (ROI =< RF)';

UPDATE asset_analyses 
SET tendencia = 'BAIXA' 
WHERE tendencia = 'BAIXA (TAXA < 0)';