-- Add notifications_enabled to profiles (all users eligible by default)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN DEFAULT true;

-- Create notification_groups table
CREATE TABLE public.notification_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create notification_group_members table
CREATE TABLE public.notification_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES public.notification_groups(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(group_id, user_id)
);

-- Add target_group_id to push_notifications
ALTER TABLE public.push_notifications ADD COLUMN IF NOT EXISTS target_group_id UUID REFERENCES public.notification_groups(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.notification_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_group_members ENABLE ROW LEVEL SECURITY;

-- RLS policies for notification_groups (admin only)
CREATE POLICY "Admins can manage notification groups" ON public.notification_groups
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS policies for notification_group_members (admin only)
CREATE POLICY "Admins can manage group members" ON public.notification_group_members
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Users can see their own group memberships
CREATE POLICY "Users can view own group memberships" ON public.notification_group_members
  FOR SELECT USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX idx_notification_group_members_group_id ON public.notification_group_members(group_id);
CREATE INDEX idx_notification_group_members_user_id ON public.notification_group_members(user_id);
CREATE INDEX idx_push_notifications_target_group ON public.push_notifications(target_group_id);

-- Update trigger for notification_groups
CREATE TRIGGER update_notification_groups_updated_at
  BEFORE UPDATE ON public.notification_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();