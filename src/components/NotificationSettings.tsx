import { Bell, BellOff, BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useNotificationPreference } from '@/hooks/useNotificationPreference';
import { toast } from 'sonner';

const NotificationSettings = () => {
  const {
    isSupported,
    permission,
    isEnabled,
    isLoading,
    setEnabled,
    showTestNotification,
  } = useNotificationPreference();

  const handleToggleNotifications = async () => {
    const newValue = !isEnabled;
    const success = await setEnabled(newValue);
    
    if (success) {
      if (newValue) {
        toast.success('Notificações ativadas com sucesso!');
        setTimeout(() => {
          showTestNotification('VALUATION', 'Você receberá alertas sobre atualizações importantes!');
        }, 1000);
      } else {
        toast.success('Notificações desativadas');
      }
    } else if (permission === 'denied') {
      toast.error('Permissão negada. Habilite as notificações nas configurações do navegador.');
    } else {
      toast.error('Erro ao atualizar configurações de notificação');
    }
  };

  const handleTestNotification = () => {
    showTestNotification('Teste de Notificação', 'Esta é uma notificação de teste do VALUATION!');
  };

  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellOff className="h-5 w-5" />
            Notificações
          </CardTitle>
          <CardDescription>
            Seu navegador não suporta notificações push.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notificações Push
        </CardTitle>
        <CardDescription>
          Receba alertas sobre atualizações importantes, novas análises e recomendações.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="notifications">Receber notificações</Label>
            <p className="text-sm text-muted-foreground">
              {isEnabled 
                ? 'Você receberá notificações sobre atualizações'
                : 'Notificações desativadas'
              }
            </p>
          </div>
          <Switch
            id="notifications"
            checked={isEnabled}
            onCheckedChange={handleToggleNotifications}
            disabled={isLoading}
          />
        </div>

        {permission === 'denied' && (
          <p className="text-sm text-destructive">
            Permissão do navegador negada. Para receber notificações, vá nas configurações do seu navegador e permita notificações para este site.
          </p>
        )}

        {isEnabled && permission === 'granted' && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleTestNotification}
            className="w-full"
          >
            <BellRing className="h-4 w-4 mr-2" />
            Enviar notificação de teste
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default NotificationSettings;
