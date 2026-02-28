-- Restore missing wallet item for Gláucia (asset aa8cc201)
INSERT INTO wallet_items (wallet_id, asset_id, quantidade, preco_compra, aporte_adicional, data_compra, created_at, updated_at, proventos)
VALUES ('a4a7bfd2-6597-4727-b375-a4cea1bafbe2', 'aa8cc201-2432-4a75-a759-b9a5d8723824', 15, 7, 0, null, now()::text, now()::text, 0);