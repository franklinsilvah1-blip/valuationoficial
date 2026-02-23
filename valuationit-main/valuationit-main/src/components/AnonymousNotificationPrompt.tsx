import { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAnonymousPushNotifications } from '@/hooks/useAnonymousPushNotifications';
import { toast } from 'sonner';

interface AnonymousNotificationPromptProps {
  delay?: number; // Delay in ms before showing prompt
}

export const AnonymousNotificationPrompt = ({ delay = 5000 }: AnonymousNotificationPromptProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const { 
    isSupported, 
    permission, 
    isSubscribed, 
    isLoading, 
    subscribe, 
    dismissPrompt,
    wasPromptDismissed 
  } = useAnonymousPushNotifications();

  useEffect(() => {
    // Don't show if not supported, already subscribed, already denied, or dismissed
    if (!isSupported || isSubscribed || permission === 'denied' || wasPromptDismissed()) {
      return;
    }

    // Show prompt after delay
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [isSupported, isSubscribed, permission, delay, wasPromptDismissed]);

  const handleActivate = async () => {
    const success = await subscribe();
    if (success) {
      toast.success('Notificações ativadas com sucesso!');
      setIsVisible(false);
    } else if (permission === 'denied') {
      toast.error('Permissão negada. Ative nas configurações do navegador.');
      setIsVisible(false);
    }
  };

  const handleDismiss = () => {
    dismissPrompt();
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-card border border-border rounded-lg shadow-lg p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
            <Bell className="h-5 w-5 text-primary" />
          </div>
          
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-foreground text-sm">
              Quer receber novidades?
            </h4>
            <p className="text-muted-foreground text-xs mt-1">
              Ative as notificações e fique por dentro das melhores oportunidades de investimento.
            </p>
            
            <div className="flex gap-2 mt-3">
              <Button 
                size="sm" 
                onClick={handleActivate}
                disabled={isLoading}
                className="text-xs"
              >
                {isLoading ? 'Ativando...' : 'Ativar notificações'}
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={handleDismiss}
                className="text-xs"
              >
                Agora não
              </Button>
            </div>
          </div>
          
          <button 
            onClick={handleDismiss}
            className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
