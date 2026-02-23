-- Alterar coluna recomendacao para TEXT para suportar novos valores da planilha
-- Os novos valores são: COMPRA, VENDA, NEUTRA, GANHOS, MANTÉM

-- Primeiro, remover a constraint de ENUM da coluna
ALTER TABLE public.asset_analyses 
ALTER COLUMN recomendacao TYPE TEXT USING recomendacao::TEXT;