-- Limpar dados duplicados e incorretos
-- Deletar análises START incorretas (onde perfil_investidor contém "FALE C/ ESPECIALISTA")
DELETE FROM public.asset_analyses
WHERE carteira = 'START'
  AND (perfil_investidor ILIKE '%FALE%ESPECIALISTA%');

-- Atualizar análises SPECIALIST existentes para FALE_C_ESPECIALISTA onde perfil_investidor indica
UPDATE public.asset_analyses
SET carteira = 'FALE_C_ESPECIALISTA'
WHERE carteira = 'SPECIALIST'
  AND (perfil_investidor ILIKE '%FALE%ESPECIALISTA%');