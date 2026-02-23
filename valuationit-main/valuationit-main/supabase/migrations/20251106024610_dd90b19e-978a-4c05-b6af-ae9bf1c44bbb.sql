-- Create sync_queue table to manage background processing
CREATE TABLE IF NOT EXISTS public.sync_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sync_log_id uuid REFERENCES public.sync_logs(id) ON DELETE CASCADE,
  row_index integer NOT NULL,
  row_data jsonb NOT NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
  error_message text,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  processed_at timestamp with time zone,
  UNIQUE(sync_log_id, row_index)
);

-- Index for efficient queue processing
CREATE INDEX idx_sync_queue_status ON public.sync_queue(status, created_at);
CREATE INDEX idx_sync_queue_log ON public.sync_queue(sync_log_id);

-- Enable RLS
ALTER TABLE public.sync_queue ENABLE ROW LEVEL SECURITY;

-- Admins can view all queue items
CREATE POLICY "Admins can view sync queue"
  ON public.sync_queue
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Service role can manage queue
CREATE POLICY "Service role can manage sync queue"
  ON public.sync_queue
  FOR ALL
  USING (true);

-- Add queue stats to sync_logs metadata
COMMENT ON TABLE public.sync_queue IS 'Queue for background processing of Google Sheets sync data';