
-- Fix sync_logs.id: add default and make NOT NULL
UPDATE public.sync_logs SET id = gen_random_uuid() WHERE id IS NULL;
ALTER TABLE public.sync_logs ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.sync_logs ALTER COLUMN id SET NOT NULL;

-- Fix sync_queue.id similarly
UPDATE public.sync_queue SET id = gen_random_uuid() WHERE id IS NULL;
ALTER TABLE public.sync_queue ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.sync_queue ALTER COLUMN id SET NOT NULL;

-- Ensure sync_lock exists in app_config (id is uuid type)
INSERT INTO public.app_config (id, key, value, created_at, updated_at)
VALUES (gen_random_uuid(), 'sync_lock', 'false', now()::text, now()::text)
ON CONFLICT DO NOTHING;

-- Clean up stuck IN_PROGRESS sync logs
UPDATE public.sync_logs 
SET status = 'FAILED', 
    completed_at = now()::text,
    errors = '[{"error":"Recovered: stuck IN_PROGRESS with null id"}]'
WHERE status = 'IN_PROGRESS';

NOTIFY pgrst, 'reload schema';
