-- Add unique constraint to enable efficient upsert on asset_analyses
ALTER TABLE asset_analyses 
ADD CONSTRAINT asset_analyses_asset_carteira_unique 
UNIQUE (asset_id, carteira);