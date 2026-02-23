import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface NotificationPreferenceState {
  isEnabled: boolean;
  isLoading: boolean;
  isSupported: boolean;
  permission: NotificationPermission | 'default';
}

export const useNotificationPreference = () => {
  const { user } = useAuth();
  const [state, setState] = useState<NotificationPreferenceState>({
    isEnabled: true,
    isLoading: true,
    isSupported: false,
    permission: 'default',
  });

  // Check notification support and load preference
  useEffect(() => {
    const isSupported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
    
    setState(prev => ({
      ...prev,
      isSupported,
      permission: isSupported ? Notification.permission : 'default',
    }));

    if (user) {
      loadPreference();
    } else {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [user]);

  const loadPreference = async () => {
    if (!user) return;
    
    try {
      const { data } = await supabase
        .from('profiles')
        .select('notifications_enabled')
        .eq('id', user.id)
        .single();

      setState(prev => ({
        ...prev,
        isEnabled: data?.notifications_enabled ?? true,
        isLoading: false,
      }));
    } catch (error) {
      console.error('Error loading notification preference:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const requestBrowserPermission = useCallback(async (): Promise<boolean> => {
    if (!state.isSupported) return false;

    try {
      const permission = await Notification.requestPermission();
      setState(prev => ({ ...prev, permission }));
      return permission === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }, [state.isSupported]);

  const ensureSubscription = useCallback(async (): Promise<boolean> => {
    if (!user || !state.isSupported) return false;

    try {
      // Check browser permission
      if (Notification.permission !== 'granted') {
        const granted = await requestBrowserPermission();
        if (!granted) return false;
      }

      const registration = await navigator.serviceWorker.ready;
      let subscription = await (registration as any).pushManager.getSubscription();

      if (!subscription) {
        const vapidKey = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
        subscription = await (registration as any).pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidKey,
        });
      }

      // Save subscription to database
      const subscriptionJson = subscription.toJSON();
      const endpoint = subscription.endpoint;
      const p256dh = subscriptionJson.keys?.p256dh || '';
      const auth = subscriptionJson.keys?.auth || '';

      // Check if already exists
      const { data: existing } = await supabase
        .from('push_subscriptions')
        .select('id')
        .eq('user_id', user.id)
        .eq('endpoint', endpoint)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('push_subscriptions')
          .update({ p256dh, auth, is_active: true, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('push_subscriptions')
          .insert({ user_id: user.id, endpoint, p256dh, auth, is_active: true });
      }

      return true;
    } catch (error) {
      console.error('Error ensuring subscription:', error);
      return false;
    }
  }, [user, state.isSupported, requestBrowserPermission]);

  const setEnabled = useCallback(async (enabled: boolean): Promise<boolean> => {
    if (!user) return false;

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      // Update profile preference
      const { error } = await supabase
        .from('profiles')
        .update({ notifications_enabled: enabled })
        .eq('id', user.id);

      if (error) throw error;

      // If enabling, ensure we have a browser subscription
      if (enabled) {
        await ensureSubscription();
      }

      setState(prev => ({ ...prev, isEnabled: enabled, isLoading: false }));
      return true;
    } catch (error) {
      console.error('Error updating notification preference:', error);
      setState(prev => ({ ...prev, isLoading: false }));
      return false;
    }
  }, [user, ensureSubscription]);

  const showTestNotification = useCallback(async (title: string, body: string) => {
    if (Notification.permission !== 'granted') {
      const granted = await requestBrowserPermission();
      if (!granted) return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, {
        body,
        icon: '/logo.webp',
        badge: '/favicon.png',
      });
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  }, [requestBrowserPermission]);

  return {
    ...state,
    setEnabled,
    requestBrowserPermission,
    ensureSubscription,
    showTestNotification,
  };
};
