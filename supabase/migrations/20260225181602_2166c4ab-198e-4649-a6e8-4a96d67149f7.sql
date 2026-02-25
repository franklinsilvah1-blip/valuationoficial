
-- Add default gen_random_uuid() to id columns that were made NOT NULL
ALTER TABLE public.assets ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.wallet_simulator ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.blog_authors ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.blog_posts ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.categories ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.affiliates ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.referrals ALTER COLUMN id SET DEFAULT gen_random_uuid();
