-- Change wallet_items columns to numeric for decimal precision
ALTER TABLE public.wallet_items
  ALTER COLUMN preco_compra TYPE numeric USING preco_compra::numeric,
  ALTER COLUMN aporte_adicional TYPE numeric USING aporte_adicional::numeric,
  ALTER COLUMN proventos TYPE numeric USING proventos::numeric;

-- Restore decimal values from backup for Franklin's wallet (39faeb7f)
UPDATE public.wallet_items SET preco_compra = 8.63 WHERE id = '5c0d2315-4e4f-44a1-b294-70bc1281aef8';
UPDATE public.wallet_items SET preco_compra = 6.08 WHERE id = '0aae2fba-a768-496f-bfb5-434967742e5e';
UPDATE public.wallet_items SET preco_compra = 8.97 WHERE id = '4445d583-0f10-4106-9b3a-8296e3326a59';
UPDATE public.wallet_items SET preco_compra = 78.29 WHERE id = 'e0530de2-98ea-48aa-8f49-2ccce34cbe7e';
UPDATE public.wallet_items SET preco_compra = 11.19 WHERE id = 'a77d4d66-b361-45b8-b02b-07b4a1adc1bb';
UPDATE public.wallet_items SET preco_compra = 128.17 WHERE id = 'e2e805d7-a3cf-4cff-b95f-05aa92e7fc58';
UPDATE public.wallet_items SET preco_compra = 66.06 WHERE id = '967c6a96-b3c6-454a-8249-bf74cac0a156';
UPDATE public.wallet_items SET preco_compra = 51.39 WHERE id = '80e053bc-7ae1-4878-a5b9-8c243cfc3eb1';
UPDATE public.wallet_items SET preco_compra = 39.06 WHERE id = '6738ec7c-2427-46d4-bbc3-5d62fbe439c2';
UPDATE public.wallet_items SET preco_compra = 67.78 WHERE id = '524c932c-765c-4a12-8950-6662147227a1';
UPDATE public.wallet_items SET preco_compra = 79.38 WHERE id = 'cda21ebe-61b1-4afe-9faf-f5609d10e382';
UPDATE public.wallet_items SET preco_compra = 14.59 WHERE id = 'da1d9489-eb3f-460c-89d2-ac51db2a97ba';
UPDATE public.wallet_items SET preco_compra = 142.34 WHERE id = 'e41dd210-3490-4ab8-8353-488eaa982b94';
UPDATE public.wallet_items SET preco_compra = 8.84 WHERE id = '1d72e08e-93df-4600-a47d-767b90cc410d';
UPDATE public.wallet_items SET preco_compra = 14 WHERE id = 'da8f07ba-498c-4782-a4dd-1d9d046fc3f3';

-- Restore decimal values for Caiuby's wallet (07095104)
UPDATE public.wallet_items SET preco_compra = 10.22 WHERE id = '3f70511f-0f63-4dcf-a071-01dec93c10d3';
UPDATE public.wallet_items SET preco_compra = 86.05 WHERE id = 'd0c37c95-949c-463d-b39c-1cd922abb1a7';
UPDATE public.wallet_items SET preco_compra = 14.01 WHERE id = 'c2252fd8-f575-481c-90c7-843f1a22912e';
UPDATE public.wallet_items SET preco_compra = 13.05 WHERE id = '43390df6-ace8-4d56-931e-ac8187602ba3';
UPDATE public.wallet_items SET preco_compra = 145.08 WHERE id = 'c9ca5d6d-c09e-40c6-9dd9-51e421501dee';
UPDATE public.wallet_items SET preco_compra = 44 WHERE id = 'f4dcd79c-7eaa-46b7-afc0-1e4434daf367';

-- Restore decimal values for Gláucia's wallet (a4a7bfd2) - including proventos
UPDATE public.wallet_items SET preco_compra = 24.11, proventos = 0 WHERE id = '1aaeed32-7879-4fe7-b522-a80747399520';
UPDATE public.wallet_items SET preco_compra = 28.62, proventos = 0.87 WHERE id = '6866a88f-cfa3-4276-b230-bec7ca66ed2e';
UPDATE public.wallet_items SET preco_compra = 14.93, proventos = 0.68 WHERE id = 'f8d46b7f-f2f6-4d2f-b5bb-db922d6b4dc9';
UPDATE public.wallet_items SET preco_compra = 9.85, proventos = 0.14 WHERE id = '65529166-6b61-4925-b184-9e5555fae13e';
UPDATE public.wallet_items SET preco_compra = 12.92, proventos = 0.11 WHERE id = '49f646b5-0e3b-493c-a8a5-f878b6330d8a';
UPDATE public.wallet_items SET preco_compra = 9.05, proventos = 0.11 WHERE id = '5f2cb0db-b3de-4916-bfa9-f6bcfb6064dc';
UPDATE public.wallet_items SET preco_compra = 6.71, proventos = 0 WHERE id = 'd2271664-c904-4932-85a4-8d46f7d73f73';

-- Restore decimal values for Diego's wallet (859908b6) - these were inserted with new IDs
-- Need to update by wallet_id + asset_id since IDs are different
UPDATE public.wallet_items SET preco_compra = 8.63 WHERE wallet_id = '859908b6-7888-467c-8f2a-c311476beeb8' AND asset_id = 'ca2cac9b-a1d2-4fcd-a9b8-99f4ece18221';
UPDATE public.wallet_items SET preco_compra = 6.08 WHERE wallet_id = '859908b6-7888-467c-8f2a-c311476beeb8' AND asset_id = '75e24684-64b5-4b03-873e-d1f496051af7';
UPDATE public.wallet_items SET preco_compra = 8.97 WHERE wallet_id = '859908b6-7888-467c-8f2a-c311476beeb8' AND asset_id = '247c5bfc-ec6f-4e66-b8d8-18e5f0a02e96';
UPDATE public.wallet_items SET preco_compra = 78.29 WHERE wallet_id = '859908b6-7888-467c-8f2a-c311476beeb8' AND asset_id = '03007e4c-3a10-421e-8474-d7a668ab0c62';
UPDATE public.wallet_items SET preco_compra = 11.19 WHERE wallet_id = '859908b6-7888-467c-8f2a-c311476beeb8' AND asset_id = 'b16719c2-8543-4ecd-93c2-a68317a70533';
UPDATE public.wallet_items SET preco_compra = 128.17 WHERE wallet_id = '859908b6-7888-467c-8f2a-c311476beeb8' AND asset_id = '2367e0d8-2b91-4308-a315-964560cd393b';
UPDATE public.wallet_items SET preco_compra = 66.06 WHERE wallet_id = '859908b6-7888-467c-8f2a-c311476beeb8' AND asset_id = 'b586ea9a-299b-4474-b86e-4771a086bf18';
UPDATE public.wallet_items SET preco_compra = 51.39 WHERE wallet_id = '859908b6-7888-467c-8f2a-c311476beeb8' AND asset_id = 'ba7fe1f9-e53b-417f-92dd-9b51a7863ff5';
UPDATE public.wallet_items SET preco_compra = 39.06 WHERE wallet_id = '859908b6-7888-467c-8f2a-c311476beeb8' AND asset_id = '24d3c40d-24f4-4866-a1d5-d58b03416030';
UPDATE public.wallet_items SET preco_compra = 67.78 WHERE wallet_id = '859908b6-7888-467c-8f2a-c311476beeb8' AND asset_id = '6a43b370-419d-41ee-9eb8-de303b1b1097';
UPDATE public.wallet_items SET preco_compra = 79.38 WHERE wallet_id = '859908b6-7888-467c-8f2a-c311476beeb8' AND asset_id = 'd0e52411-d1c1-4619-9f76-1ad82b4332d6';
UPDATE public.wallet_items SET preco_compra = 14.59 WHERE wallet_id = '859908b6-7888-467c-8f2a-c311476beeb8' AND asset_id = 'ccb565c9-140c-4a4d-8568-0c3add365759';
UPDATE public.wallet_items SET preco_compra = 142.34 WHERE wallet_id = '859908b6-7888-467c-8f2a-c311476beeb8' AND asset_id = '90ddd519-6ff6-4898-a987-8a79539f73b7';
UPDATE public.wallet_items SET preco_compra = 8.84 WHERE wallet_id = '859908b6-7888-467c-8f2a-c311476beeb8' AND asset_id = '0d6137b8-4c32-4b02-a87c-a20552c44926';
UPDATE public.wallet_items SET preco_compra = 14 WHERE wallet_id = '859908b6-7888-467c-8f2a-c311476beeb8' AND asset_id = '090300d6-61cf-46dd-b75f-ebfd5090cc46';