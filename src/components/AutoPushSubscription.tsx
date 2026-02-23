import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { VAPID_PUBLIC_KEY } from '@/utils/vapidKey';

/**
 * Component that automatically requests push notification permission
 * and creates subscription for logged-in users with notifications_enabled = true
 */
export const AutoPushSubscription = () => {
  const { user } = useAuth();
  const hasAttempted = useRef(false);

  useEffect(() => {
    if (!user || hasAttempted.current) return;

    const setupPushSubscription = async () => {
      hasAttempted.current = true;

      // Check browser support
      const isSupported = 'Notification' in window && 
                          'serviceWorker' in navigator && 
                          'PushManager' in window;
      
      if (!isSupported) {
        console.log('Push notifications not supported');
        return;
      }

      // Check if user has notifications enabled in profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('notifications_enabled')
        .eq('id', user.id)
        .single();

      if (!profile?.notifications_enabled) {
        console.log('User has notifications disabled in profile');
        return;
      }

      // Check if already has active subscription
      const { data: existingSubscription } = await supabase
        .from('push_subscriptions')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (existingSubscription) {
        console.log('User already has active push subscription');
        return;
      }

      // If permission already granted, subscribe silently
      if (Notification.permission === 'granted') {
        await createSubscription();
        return;
      }

      // If permission denied, don't bother
      if (Notification.permission === 'denied') {
        console.log('Notification permission denied by browser');
        return;
      }

      // Permission is 'default', request it after a short delay
      setTimeout(async () => {
        try {
          const permission = await Notification.requestPermission();
          if (permission === 'granted') {
            await createSubscription();
          }
        } catch (error) {
          console.error('Error requesting notification permission:', error);
        }
      }, 3000); // Wait 3 seconds after login
    };

    const createSubscription = async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        let subscription = await (registration as any).pushManager.getSubscription();

        if (!subscription) {
          subscription = await (registration as any).pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: VAPID_PUBLIC_KEY,
          });
        }

        const subscriptionJson = subscription.toJSON();
        const endpoint = subscription.endpoint;
        const p256dh = subscriptionJson.keys?.p256dh || '';
        const auth = subscriptionJson.keys?.auth || '';

        // Check if already exists for this endpoint
        const { data: existing } = await supabase
          .from('push_subscriptions')
          .select('id')
          .eq('user_id', user!.id)
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
            .insert({ user_id: user!.id, endpoint, p256dh, auth, is_active: true });
        }

        console.log('Auto push subscription created successfully');
      } catch (error) {
        console.error('Error creating auto push subscription:', error);
      }
    };

    setupPushSubscription();
  }, [user]);

  return null; // This component doesn't render anything
};
