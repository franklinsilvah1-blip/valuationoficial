-- Adicionar novas colunas na tabela asset_analyses
ALTER TABLE public.asset_analyses
  ADD COLUMN perfil_investidor investor_profile,
  ADD COLUMN taxa_semanal numeric(10,2),
  ADD COLUMN roi numeric(10,2),
  ADD COLUMN roi25 numeric(10,2);

-- Adicionar comentários para documentação
COMMENT ON COLUMN asset_analyses.perfil_investidor IS 'Perfil de investidor recomendado (Conservador/Moderado/Agressivo)';
COMMENT ON COLUMN asset_analyses.taxa_semanal IS 'Taxa de retorno semanal esperada (%)';
COMMENT ON COLUMN asset_analyses.roi IS 'Return on Investment (%)';
COMMENT ON COLUMN asset_analyses.roi25 IS 'ROI projetado para 2025 (%)';