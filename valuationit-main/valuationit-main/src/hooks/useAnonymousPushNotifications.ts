import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { VAPID_PUBLIC_KEY, urlBase64ToUint8Array } from '@/utils/vapidKey';

const DEVICE_ID_KEY = 'push_device_id';
const NOTIFICATION_DISMISSED_KEY = 'push_notification_dismissed';

interface AnonymousPushState {
  isSupported: boolean;
  permission: NotificationPermission | 'default';
  isSubscribed: boolean;
  isLoading: boolean;
  deviceId: string | null;
}

export const useAnonymousPushNotifications = () => {
  const [state, setState] = useState<AnonymousPushState>({
    isSupported: false,
    permission: 'default',
    isSubscribed: false,
    isLoading: true,
    deviceId: null
  });

  // Check if notifications are supported
  useEffect(() => {
    const checkSupport = async () => {
      const supported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
      const deviceId = localStorage.getItem(DEVICE_ID_KEY);
      
      setState(prev => ({
        ...prev,
        isSupported: supported,
        permission: supported ? Notification.permission : 'default',
        deviceId,
        isLoading: false
      }));

      if (supported && deviceId) {
        // Check if subscription is still active
        await checkExistingSubscription(deviceId);
      }
    };

    checkSupport();
  }, []);

  const checkExistingSubscription = async (deviceId: string) => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await (registration as any).pushManager.getSubscription();
      
      setState(prev => ({
        ...prev,
        isSubscribed: !!subscription
      }));
    } catch (error) {
      console.error('Error checking subscription:', error);
    }
  };


  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!state.isSupported) {
      console.log('Push notifications not supported');
      return false;
    }

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      // Request permission
      const permission = await Notification.requestPermission();
      setState(prev => ({ ...prev, permission }));

      if (permission !== 'granted') {
        console.log('Notification permission denied');
        setState(prev => ({ ...prev, isLoading: false }));
        return false;
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Subscribe to push
      const subscription = await (registration as any).pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });

      const subscriptionJson = subscription.toJSON();
      const existingDeviceId = localStorage.getItem(DEVICE_ID_KEY);

      // Send to edge function
      const { data, error } = await supabase.functions.invoke('subscribe-anonymous', {
        body: {
          endpoint: subscriptionJson.endpoint,
          p256dh: subscriptionJson.keys?.p256dh,
          auth: subscriptionJson.keys?.auth,
          deviceId: existingDeviceId
        }
      });

      if (error) throw error;

      // Save device ID
      if (data?.deviceId) {
        localStorage.setItem(DEVICE_ID_KEY, data.deviceId);
        setState(prev => ({ 
          ...prev, 
          deviceId: data.deviceId,
          isSubscribed: true,
          isLoading: false
        }));
      }

      console.log('Anonymous push subscription successful');
      return true;

    } catch (error) {
      console.error('Error subscribing to push:', error);
      setState(prev => ({ ...prev, isLoading: false }));
      return false;
    }
  }, [state.isSupported]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await (registration as any).pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();
      }

      // Mark as inactive in database if we have a device ID
      const deviceId = localStorage.getItem(DEVICE_ID_KEY);
      if (deviceId) {
        // We can't directly update from client without auth, 
        // but the subscription is unsubscribed in the browser
        // Next time they subscribe, it will be a new subscription
      }

      setState(prev => ({ 
        ...prev, 
        isSubscribed: false,
        isLoading: false
      }));

      return true;
    } catch (error) {
      console.error('Error unsubscribing:', error);
      setState(prev => ({ ...prev, isLoading: false }));
      return false;
    }
  }, []);

  const dismissPrompt = useCallback(() => {
    localStorage.setItem(NOTIFICATION_DISMISSED_KEY, 'true');
  }, []);

  const wasPromptDismissed = useCallback((): boolean => {
    return localStorage.getItem(NOTIFICATION_DISMISSED_KEY) === 'true';
  }, []);

  return {
    ...state,
    subscribe,
    unsubscribe,
    dismissPrompt,
    wasPromptDismissed
  };
};
