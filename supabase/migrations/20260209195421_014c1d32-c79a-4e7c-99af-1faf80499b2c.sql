
-- Remover FKs com CASCADE
ALTER TABLE asset_favorites DROP CONSTRAINT asset_favorites_asset_id_fkey;
ALTER TABLE wallet_items DROP CONSTRAINT wallet_items_asset_id_fkey;

-- Recriar FKs com SET NULL para asset_favorites
ALTER TABLE asset_favorites 
  ALTER COLUMN asset_id DROP NOT NULL;
ALTER TABLE asset_favorites 
  ADD CONSTRAINT asset_favorites_asset_id_fkey 
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE SET NULL;

-- Recriar FK com SET NULL para wallet_items
ALTER TABLE wallet_items 
  ALTER COLUMN asset_id DROP NOT NULL;
ALTER TABLE wallet_items 
  ADD CONSTRAINT wallet_items_asset_id_fkey 
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE SET NULL;
