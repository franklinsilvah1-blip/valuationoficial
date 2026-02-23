-- Atualizar valores de tendência antigos para os novos padrões
-- Mapear ALTA_1A2X, ALTA_2A4X, ALTA_4X para ALTA (ROI > TR)
UPDATE asset_analyses 
SET tendencia = 'ALTA (ROI > TR)' 
WHERE tendencia IN ('ALTA_1A2X > TAXA BASE', 'ALTA_2A4X > TAXA BASE', 'ALTA_4X > TAXA BASE');

-- Mapear AVALIE TAXA/RISCO para NEUTRA (ROI =< RF)
UPDATE asset_analyses 
SET tendencia = 'NEUTRA (ROI =< RF)' 
WHERE tendencia = 'AVALIE TAXA/RISCO';

-- Mapear BAIXA_TAXA NEGATIVA e BAIXA_RISCO > ROI para BAIXA (TAXA < 0)
UPDATE asset_analyses 
SET tendencia = 'BAIXA (TAXA < 0)' 
WHERE tendencia IN ('BAIXA_TAXA NEGATIVA', 'BAIXA_RISCO > ROI');