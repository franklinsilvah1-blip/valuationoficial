-- Remover constraint antiga
ALTER TABLE push_notifications 
DROP CONSTRAINT IF EXISTS push_notifications_target_audience_check;

-- Criar nova constraint com todos os valores válidos
ALTER TABLE push_notifications 
ADD CONSTRAINT push_notifications_target_audience_check 
CHECK (target_audience = ANY (ARRAY['all', 'free', 'paid', 'specific_plan', 'logged_in', 'anonymous', 'group']));