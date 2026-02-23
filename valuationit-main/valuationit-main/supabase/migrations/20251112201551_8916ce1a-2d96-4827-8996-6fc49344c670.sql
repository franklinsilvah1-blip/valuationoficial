-- Criar novo enum sem CRYPTO
CREATE TYPE asset_type_new AS ENUM ('FII', 'ACAO', 'BDR', 'CRIPTO', 'ETF', 'INDICE');

-- Atualizar coluna tipo convertendo CRYPTO para CRIPTO
ALTER TABLE assets 
  ALTER COLUMN tipo TYPE asset_type_new 
  USING (
    CASE 
      WHEN tipo::text = 'CRYPTO' THEN 'CRIPTO'::asset_type_new
      ELSE tipo::text::asset_type_new
    END
  );

-- Remover enum antigo
DROP TYPE asset_type;

-- Renomear novo enum
ALTER TYPE asset_type_new RENAME TO asset_type;