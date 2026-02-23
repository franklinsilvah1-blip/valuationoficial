-- Criar nova coluna temporária do tipo text
ALTER TABLE public.asset_analyses 
ADD COLUMN nota_especialista_new text;

-- Copiar dados convertendo integer para text
UPDATE public.asset_analyses 
SET nota_especialista_new = CASE 
  WHEN nota_especialista IS NULL THEN NULL
  ELSE nota_especialista::text 
END;

-- Remover coluna antiga
ALTER TABLE public.asset_analyses 
DROP COLUMN nota_especialista;

-- Renomear nova coluna
ALTER TABLE public.asset_analyses 
RENAME COLUMN nota_especialista_new TO nota_especialista;

-- Adicionar comentário
COMMENT ON COLUMN public.asset_analyses.nota_especialista IS 'Nota do especialista (valores como "Nenhuma nota específica", "Ativo TOP DY Valuation", "Ativo TOP 10 Club START")';