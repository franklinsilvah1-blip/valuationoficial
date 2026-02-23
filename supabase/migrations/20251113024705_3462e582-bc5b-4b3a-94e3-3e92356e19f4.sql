-- Add cancellation flag to sync_logs table
ALTER TABLE sync_logs 
ADD COLUMN IF NOT EXISTS cancellation_requested BOOLEAN DEFAULT false;