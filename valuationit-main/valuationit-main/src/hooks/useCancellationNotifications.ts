import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CancellationPayload {
  id: string;
  user_id: string;
  reason: string;
  details: string | null;
  created_at: string;
}

export const useCancellationNotifications = (enabled: boolean = true) => {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel('cancellation-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'cancellation_feedback'
        },
        async (payload) => {
          const newCancellation = payload.new as CancellationPayload;
          
          // Fetch user info
          const { data: profile } = await supabase
            .from('profiles')
            .select('name, email')
            .eq('id', newCancellation.user_id)
            .single();

          const userName = profile?.name || profile?.email || 'Usuário';
          
          toast.error('Novo Cancelamento', {
            description: `${userName} cancelou: ${newCancellation.reason}`,
            duration: 8000,
            action: {
              label: 'Ver detalhes',
              onClick: () => {
                window.location.href = '/app/admin/cancellations';
              }
            }
          });
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [enabled]);
};
