
-- Fix NULL ids first
UPDATE profile_answers SET id = gen_random_uuid() WHERE id IS NULL;
UPDATE rate_limit_log SET id = gen_random_uuid() WHERE id IS NULL;

-- Tables needing DEFAULT + NOT NULL + PK
ALTER TABLE admin_audit_log ALTER COLUMN id SET DEFAULT gen_random_uuid(), ALTER COLUMN id SET NOT NULL;
ALTER TABLE admin_audit_log ADD PRIMARY KEY (id);

ALTER TABLE affiliate_clicks ALTER COLUMN id SET DEFAULT gen_random_uuid(), ALTER COLUMN id SET NOT NULL;
ALTER TABLE affiliate_clicks ADD PRIMARY KEY (id);

ALTER TABLE app_config ALTER COLUMN id SET DEFAULT gen_random_uuid(), ALTER COLUMN id SET NOT NULL;
ALTER TABLE app_config ADD PRIMARY KEY (id);

ALTER TABLE asset_favorites ALTER COLUMN id SET DEFAULT gen_random_uuid(), ALTER COLUMN id SET NOT NULL;
ALTER TABLE asset_favorites ADD PRIMARY KEY (id);

ALTER TABLE asset_views ALTER COLUMN id SET DEFAULT gen_random_uuid(), ALTER COLUMN id SET NOT NULL;
ALTER TABLE asset_views ADD PRIMARY KEY (id);

ALTER TABLE blog_authors_public ALTER COLUMN id SET DEFAULT gen_random_uuid(), ALTER COLUMN id SET NOT NULL;
ALTER TABLE blog_authors_public ADD PRIMARY KEY (id);

ALTER TABLE cancellation_feedback ALTER COLUMN id SET DEFAULT gen_random_uuid(), ALTER COLUMN id SET NOT NULL;
ALTER TABLE cancellation_feedback ADD PRIMARY KEY (id);

ALTER TABLE commissions ALTER COLUMN id SET DEFAULT gen_random_uuid(), ALTER COLUMN id SET NOT NULL;
ALTER TABLE commissions ADD PRIMARY KEY (id);

ALTER TABLE exclusive_videos ALTER COLUMN id SET DEFAULT gen_random_uuid(), ALTER COLUMN id SET NOT NULL;
ALTER TABLE exclusive_videos ADD PRIMARY KEY (id);

ALTER TABLE import_jobs ALTER COLUMN id SET DEFAULT gen_random_uuid(), ALTER COLUMN id SET NOT NULL;
ALTER TABLE import_jobs ADD PRIMARY KEY (id);

ALTER TABLE leads ALTER COLUMN id SET DEFAULT gen_random_uuid(), ALTER COLUMN id SET NOT NULL;
ALTER TABLE leads ADD PRIMARY KEY (id);

ALTER TABLE notification_group_members ALTER COLUMN id SET DEFAULT gen_random_uuid(), ALTER COLUMN id SET NOT NULL;
ALTER TABLE notification_group_members ADD PRIMARY KEY (id);

ALTER TABLE notification_groups ALTER COLUMN id SET DEFAULT gen_random_uuid(), ALTER COLUMN id SET NOT NULL;
ALTER TABLE notification_groups ADD PRIMARY KEY (id);

ALTER TABLE post_categories ALTER COLUMN id SET DEFAULT gen_random_uuid(), ALTER COLUMN id SET NOT NULL;
ALTER TABLE post_categories ADD PRIMARY KEY (id);

ALTER TABLE profile_answers ALTER COLUMN id SET DEFAULT gen_random_uuid(), ALTER COLUMN id SET NOT NULL;
ALTER TABLE profile_answers ADD PRIMARY KEY (id);

ALTER TABLE profile_options ALTER COLUMN id SET DEFAULT gen_random_uuid(), ALTER COLUMN id SET NOT NULL;
ALTER TABLE profile_options ADD PRIMARY KEY (id);

ALTER TABLE profile_questions ALTER COLUMN id SET DEFAULT gen_random_uuid(), ALTER COLUMN id SET NOT NULL;
ALTER TABLE profile_questions ADD PRIMARY KEY (id);

ALTER TABLE push_notifications ALTER COLUMN id SET DEFAULT gen_random_uuid(), ALTER COLUMN id SET NOT NULL;
ALTER TABLE push_notifications ADD PRIMARY KEY (id);

ALTER TABLE push_subscriptions ALTER COLUMN id SET DEFAULT gen_random_uuid(), ALTER COLUMN id SET NOT NULL;
ALTER TABLE push_subscriptions ADD PRIMARY KEY (id);

ALTER TABLE rate_limit_log ALTER COLUMN id SET DEFAULT gen_random_uuid(), ALTER COLUMN id SET NOT NULL;
ALTER TABLE rate_limit_log ADD PRIMARY KEY (id);

ALTER TABLE sites ALTER COLUMN id SET DEFAULT gen_random_uuid(), ALTER COLUMN id SET NOT NULL;
ALTER TABLE sites ADD PRIMARY KEY (id);

ALTER TABLE smtp_config ALTER COLUMN id SET DEFAULT gen_random_uuid(), ALTER COLUMN id SET NOT NULL;
ALTER TABLE smtp_config ADD PRIMARY KEY (id);

ALTER TABLE subscription_plans ALTER COLUMN id SET DEFAULT gen_random_uuid(), ALTER COLUMN id SET NOT NULL;
ALTER TABLE subscription_plans ADD PRIMARY KEY (id);

ALTER TABLE tracking_events ALTER COLUMN id SET DEFAULT gen_random_uuid(), ALTER COLUMN id SET NOT NULL;
ALTER TABLE tracking_events ADD PRIMARY KEY (id);

ALTER TABLE tracking_scripts ALTER COLUMN id SET DEFAULT gen_random_uuid(), ALTER COLUMN id SET NOT NULL;
ALTER TABLE tracking_scripts ADD PRIMARY KEY (id);

ALTER TABLE user_roles ALTER COLUMN id SET DEFAULT gen_random_uuid(), ALTER COLUMN id SET NOT NULL;
ALTER TABLE user_roles ADD PRIMARY KEY (id);

ALTER TABLE wallet_items ALTER COLUMN id SET DEFAULT gen_random_uuid(), ALTER COLUMN id SET NOT NULL;
ALTER TABLE wallet_items ADD PRIMARY KEY (id);

-- Tables with NOT NULL + DEFAULT but missing PK
ALTER TABLE affiliates ADD PRIMARY KEY (id);
ALTER TABLE assets ADD PRIMARY KEY (id);
ALTER TABLE blog_authors ADD PRIMARY KEY (id);
ALTER TABLE blog_posts ADD PRIMARY KEY (id);
ALTER TABLE categories ADD PRIMARY KEY (id);
ALTER TABLE referrals ADD PRIMARY KEY (id);
ALTER TABLE sync_logs ADD PRIMARY KEY (id);
ALTER TABLE sync_queue ADD PRIMARY KEY (id);
ALTER TABLE wallet_simulator ADD PRIMARY KEY (id);
