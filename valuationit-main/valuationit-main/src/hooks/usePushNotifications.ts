import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { VAPID_PUBLIC_KEY } from '@/utils/vapidKey';

interface PushNotificationState {
  isSupported: boolean;
  permission: NotificationPermission | 'default';
  isSubscribed: boolean;
  isLoading: boolean;
}

export const usePushNotifications = () => {
  const { user } = useAuth();
  const [state, setState] = useState<PushNotificationState>({
    isSupported: false,
    permission: 'default',
    isSubscribed: false,
    isLoading: false
  });

  useEffect(() => {
    const isSupported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
    
    setState(prev => ({
      ...prev,
      isSupported,
      permission: isSupported ? Notification.permission : 'default'
    }));

    if (isSupported && Notification.permission === 'granted' && user) {
      checkSubscription();
    }
  }, [user]);

  const checkSubscription = async () => {
    try {
      if (!user) return;
      
      // Verificar no banco de dados se já tem subscription
      const { data } = await supabase
        .from("push_subscriptions")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      setState(prev => ({ ...prev, isSubscribed: !!data }));
    } catch (error) {
      console.error('Error checking subscription:', error);
    }
  };

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!state.isSupported) {
      console.warn('Push notifications not supported');
      return false;
    }

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const permission = await Notification.requestPermission();
      setState(prev => ({ ...prev, permission, isLoading: false }));
      
      return permission === 'granted';
    } catch (error) {
      console.error('Error requesting permission:', error);
      setState(prev => ({ ...prev, isLoading: false }));
      return false;
    }
  }, [state.isSupported]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!user) {
      console.warn('User must be logged in to subscribe');
      return false;
    }

    if (!state.isSupported || state.permission !== 'granted') {
      const granted = await requestPermission();
      if (!granted) return false;
    }

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const registration = await navigator.serviceWorker.ready;
      
      // Check if already subscribed
      let subscription = await (registration as any).pushManager.getSubscription();
      
      if (!subscription) {
        subscription = await (registration as any).pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: VAPID_PUBLIC_KEY
        });
      }

      // Extrair dados da subscription
      const subscriptionJson = subscription.toJSON();
      const endpoint = subscription.endpoint;
      const p256dh = subscriptionJson.keys?.p256dh || '';
      const auth = subscriptionJson.keys?.auth || '';

      // Verificar se já existe subscription para este endpoint
      const { data: existing } = await supabase
        .from("push_subscriptions")
        .select("id")
        .eq("user_id", user.id)
        .eq("endpoint", endpoint)
        .maybeSingle();

      if (existing) {
        // Atualizar subscription existente
        await supabase
          .from("push_subscriptions")
          .update({ 
            p256dh, 
            auth, 
            is_active: true,
            updated_at: new Date().toISOString()
          })
          .eq("id", existing.id);
      } else {
        // Criar nova subscription
        const { error } = await supabase
          .from("push_subscriptions")
          .insert({
            user_id: user.id,
            endpoint,
            p256dh,
            auth,
            is_active: true
          });

        if (error) {
          console.error('Error saving subscription:', error);
          throw error;
        }
      }

      console.log('Push subscription saved successfully');
      setState(prev => ({ ...prev, isSubscribed: true, isLoading: false }));
      return true;
    } catch (error) {
      console.error('Error subscribing to push:', error);
      setState(prev => ({ ...prev, isLoading: false }));
      return false;
    }
  }, [state.isSupported, state.permission, user, requestPermission]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await (registration as any).pushManager.getSubscription();
      
      if (subscription) {
        await subscription.unsubscribe();
        
        // Marcar como inativo no banco
        await supabase
          .from("push_subscriptions")
          .update({ is_active: false })
          .eq("user_id", user.id)
          .eq("endpoint", subscription.endpoint);
      }

      setState(prev => ({ ...prev, isSubscribed: false, isLoading: false }));
      return true;
    } catch (error) {
      console.error('Error unsubscribing:', error);
      setState(prev => ({ ...prev, isLoading: false }));
      return false;
    }
  }, [user]);

  const showLocalNotification = useCallback(async (title: string, options?: NotificationOptions) => {
    if (state.permission !== 'granted') {
      const granted = await requestPermission();
      if (!granted) return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, {
        icon: '/logo.webp',
        badge: '/favicon.png',
        ...options
      });
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  }, [state.permission, requestPermission]);

  return {
    ...state,
    requestPermission,
    subscribe,
    unsubscribe,
    showLocalNotification
  };
};
