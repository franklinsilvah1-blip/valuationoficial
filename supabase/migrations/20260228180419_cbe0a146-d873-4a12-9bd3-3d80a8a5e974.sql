-- Restore Diego's 16 wallet items from backup into his wallet
-- Using new UUIDs since original IDs belong to Franklin's wallet
INSERT INTO wallet_items (wallet_id, asset_id, quantidade, preco_compra, aporte_adicional, data_compra, created_at, updated_at, proventos) VALUES
('859908b6-7888-467c-8f2a-c311476beeb8', 'ca2cac9b-a1d2-4fcd-a9b8-99f4ece18221', 400, 8.63, 0, null, now()::text, now()::text, 0),
('859908b6-7888-467c-8f2a-c311476beeb8', '75e24684-64b5-4b03-873e-d1f496051af7', 150, 6.08, 0, null, now()::text, now()::text, 0),
('859908b6-7888-467c-8f2a-c311476beeb8', '247c5bfc-ec6f-4e66-b8d8-18e5f0a02e96', 101, 8.97, 0, null, now()::text, now()::text, 0),
('859908b6-7888-467c-8f2a-c311476beeb8', '03007e4c-3a10-421e-8474-d7a668ab0c62', 20, 78.29, 0, null, now()::text, now()::text, 0),
('859908b6-7888-467c-8f2a-c311476beeb8', 'b16719c2-8543-4ecd-93c2-a68317a70533', 100, 11.19, 0, null, now()::text, now()::text, 0),
('859908b6-7888-467c-8f2a-c311476beeb8', '2367e0d8-2b91-4308-a315-964560cd393b', 10, 128.17, 0, null, now()::text, now()::text, 0),
('859908b6-7888-467c-8f2a-c311476beeb8', 'b586ea9a-299b-4474-b86e-4771a086bf18', 28, 66.06, 0, null, now()::text, now()::text, 0),
('859908b6-7888-467c-8f2a-c311476beeb8', 'ba7fe1f9-e53b-417f-92dd-9b51a7863ff5', 50, 51.39, 0, null, now()::text, now()::text, 0),
('859908b6-7888-467c-8f2a-c311476beeb8', '24d3c40d-24f4-4866-a1d5-d58b03416030', 30, 39.06, 0, null, now()::text, now()::text, 0),
('859908b6-7888-467c-8f2a-c311476beeb8', '6a43b370-419d-41ee-9eb8-de303b1b1097', 15, 67.78, 0, null, now()::text, now()::text, 0),
('859908b6-7888-467c-8f2a-c311476beeb8', 'd0e52411-d1c1-4619-9f76-1ad82b4332d6', 15, 79.38, 0, null, now()::text, now()::text, 0),
('859908b6-7888-467c-8f2a-c311476beeb8', 'ccb565c9-140c-4a4d-8568-0c3add365759', 175, 14.59, 0, null, now()::text, now()::text, 0),
('859908b6-7888-467c-8f2a-c311476beeb8', '90ddd519-6ff6-4898-a987-8a79539f73b7', 7, 142.34, 0, null, now()::text, now()::text, 0),
('859908b6-7888-467c-8f2a-c311476beeb8', '0d6137b8-4c32-4b02-a87c-a20552c44926', 100, 8.84, 0, null, now()::text, now()::text, 0),
('859908b6-7888-467c-8f2a-c311476beeb8', '090300d6-61cf-46dd-b75f-ebfd5090cc46', 500, 14, 0, null, now()::text, now()::text, 0);