-- Alterar perfil_investidor de ENUM para TEXT para aceitar valores customizados
ALTER TABLE public.asset_analyses 
ALTER COLUMN perfil_investidor DROP DEFAULT;

ALTER TABLE public.asset_analyses 
ALTER COLUMN perfil_investidor TYPE TEXT 
USING perfil_investidor::TEXT;

-- Adicionar comentário explicando o campo
COMMENT ON COLUMN public.asset_analyses.perfil_investidor IS 'Perfil do investidor recomendado - aceita valores customizados da planilha';