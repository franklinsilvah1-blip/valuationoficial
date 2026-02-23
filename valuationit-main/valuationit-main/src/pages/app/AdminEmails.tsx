import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, CheckCircle2, AlertCircle, Send } from "lucide-react";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface EmailType {
  id: string;
  name: string;
  description: string;
  trigger: string;
  recipients: string;
  service: 'SMTP' | 'Resend';
  edgeFunction: string;
  canTest: boolean;
  status: 'configured' | 'missing_config';
}

interface ConfigStatus {
  smtp: boolean;
  resend: boolean;
  adminEmail: string | null;
}

const AdminEmails = () => {
  const { isAdmin, loading } = useAdminCheck();
  const { toast } = useToast();
  const [configStatus, setConfigStatus] = useState<ConfigStatus>({
    smtp: false,
    resend: false,
    adminEmail: null,
  });
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [selectedEmailType, setSelectedEmailType] = useState<string>("");
  const [testEmail, setTestEmail] = useState("");
  const [sendingTest, setSendingTest] = useState(false);

  const emailTypes: EmailType[] = [
    {
      id: 'welcome',
      name: 'Email de Boas-vindas',
      description: 'Enviado quando um usuário assina um plano pago',
      trigger: 'Webhook Stripe (checkout.session.completed)',
      recipients: 'Novo assinante',
      service: 'SMTP',
      edgeFunction: 'send-welcome-email',
      canTest: true,
      status: configStatus.smtp ? 'configured' : 'missing_config',
    },
    {
      id: 'admin-webhook-failure',
      name: 'Notificação: Falha em Webhook',
      description: 'Alerta quando webhook do Stripe falha no processamento',
      trigger: 'Erro no processamento de webhook do Stripe',
      recipients: 'Administrador',
      service: 'SMTP',
      edgeFunction: 'send-admin-notification',
      canTest: true,
      status: configStatus.smtp && configStatus.adminEmail ? 'configured' : 'missing_config',
    },
    {
      id: 'admin-payment-failure',
      name: 'Notificação: Falha em Pagamento',
      description: 'Alerta quando há falha em pagamento recorrente',
      trigger: 'Falha em cobrança automática',
      recipients: 'Administrador',
      service: 'SMTP',
      edgeFunction: 'send-admin-notification',
      canTest: true,
      status: configStatus.smtp && configStatus.adminEmail ? 'configured' : 'missing_config',
    },
    {
      id: 'admin-sync-failure',
      name: 'Notificação: Falha em Sincronização',
      description: 'Alerta quando sincronização de dados falha',
      trigger: 'Erro na sincronização do Google Sheets',
      recipients: 'Administrador',
      service: 'SMTP',
      edgeFunction: 'send-admin-notification',
      canTest: true,
      status: configStatus.smtp && configStatus.adminEmail ? 'configured' : 'missing_config',
    },
    {
      id: 'password-recovery',
      name: 'Recuperação de Senha',
      description: 'Link para redefinir senha do usuário',
      trigger: 'Solicitação manual na página /auth',
      recipients: 'Usuário solicitante',
      service: 'Resend',
      edgeFunction: 'send-password-recovery-request',
      canTest: true,
      status: configStatus.resend ? 'configured' : 'missing_config',
    },
    {
      id: 'sync-notification',
      name: 'Notificação de Sincronização',
      description: 'Relatório de sincronização do Google Sheets concluída',
      trigger: 'Final do processo de sincronização',
      recipients: 'Todos os administradores',
      service: 'Resend',
      edgeFunction: 'send-sync-notification',
      canTest: true,
      status: configStatus.resend ? 'configured' : 'missing_config',
    },
    {
      id: 'contact',
      name: 'Email de Contato',
      description: 'Confirmação de recebimento de formulário de contato',
      trigger: 'Envio do formulário de contato',
      recipients: 'Email configurado no SMTP (sender_email)',
      service: 'Resend',
      edgeFunction: 'send-contact-email',
      canTest: true,
      status: configStatus.resend && configStatus.smtp ? 'configured' : 'missing_config',
    },
    {
      id: 'expiring-plans',
      name: 'Planos Expirando',
      description: 'Aviso sobre plano prestes a expirar (7 dias antes)',
      trigger: 'Cron job automático diário',
      recipients: 'Usuários com plano expirando',
      service: 'SMTP',
      edgeFunction: 'check-expiring-plans',
      canTest: true,
      status: configStatus.smtp ? 'configured' : 'missing_config',
    },
  ];

  useEffect(() => {
    const loadConfigStatus = async () => {
      try {
        setLoadingConfig(true);

        // Check SMTP config
        const { data: smtpData, error: smtpError } = await supabase
          .from('smtp_config')
          .select('*')
          .single();

        // Get current logged admin user email
        const { data: { user } } = await supabase.auth.getUser();
        let userEmail = null;
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('email')
            .eq('id', user.id)
            .single();
          userEmail = profile?.email || user.email || null;
        }

        setConfigStatus({
          smtp: !smtpError && smtpData !== null,
          resend: true, // Resend key is in secrets, assume configured
          adminEmail: userEmail,
        });
      } catch (error) {
        console.error('Error loading config status:', error);
      } finally {
        setLoadingConfig(false);
      }
    };

    if (isAdmin) {
      loadConfigStatus();
    }
  }, [isAdmin]);

  const openTestDialog = (emailId: string) => {
    setSelectedEmailType(emailId);
    setTestEmail("");
    setTestDialogOpen(true);
  };

  const handleSendTestEmail = async () => {
    if (!testEmail || !testEmail.includes("@")) {
      toast({
        title: "Email inválido",
        description: "Por favor, insira um email válido",
        variant: "destructive",
      });
      return;
    }

    try {
      setSendingTest(true);
      const { data, error } = await supabase.functions.invoke("test-email", {
        body: { emailType: selectedEmailType, testEmail },
      });

      if (error) throw error;

      toast({
        title: "Email de teste enviado",
        description: `Email enviado com sucesso para ${testEmail}`,
      });

      setTestDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Erro ao enviar email de teste",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSendingTest(false);
    }
  };

  if (loading || !isAdmin) {
    return null;
  }

  return (
    <AppLayout title="Gerenciar Emails">
      <div className="container py-12">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Gerenciamento de Emails</h1>
          <p className="text-muted-foreground">
            Configure e visualize os tipos de emails enviados pelo sistema
          </p>
        </div>

        {/* Configuration Status */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                {configStatus.smtp ? (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-destructive" />
                )}
                Configuração SMTP
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant={configStatus.smtp ? "default" : "destructive"}>
                {configStatus.smtp ? "Configurado" : "Não Configurado"}
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                {configStatus.resend ? (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-destructive" />
                )}
                Resend API Key
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant={configStatus.resend ? "default" : "destructive"}>
                {configStatus.resend ? "Configurado" : "Não Configurado"}
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                {configStatus.adminEmail ? (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-destructive" />
                )}
                Email do Admin
              </CardTitle>
            </CardHeader>
            <CardContent>
              {configStatus.adminEmail ? (
                <p className="text-sm text-muted-foreground truncate">
                  {configStatus.adminEmail}
                </p>
              ) : (
                <Badge variant="destructive">Não Configurado</Badge>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Missing Config Alert */}
        {(!configStatus.smtp || !configStatus.adminEmail) && (
          <Alert className="mb-8">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Configuração Incompleta</AlertTitle>
            <AlertDescription>
              Alguns emails não funcionarão corretamente sem as configurações necessárias.
              {!configStatus.smtp && " Configure o SMTP em Configuração SMTP."}
              {!configStatus.adminEmail && " Configure o email do administrador."}
            </AlertDescription>
          </Alert>
        )}

        {/* Email Types Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {emailTypes.map((email) => (
            <Card
              key={email.id}
              className="shadow-card hover:shadow-elevated transition-all duration-300"
            >
              <CardHeader>
                <div className="flex items-start justify-between mb-2">
                  <Mail className="h-8 w-8 text-primary" />
                  <Badge
                    variant={email.status === 'configured' ? 'default' : 'destructive'}
                  >
                    {email.status === 'configured' ? 'Configurado' : 'Config. Faltando'}
                  </Badge>
                </div>
                <CardTitle className="flex items-center gap-2">
                  {email.name}
                </CardTitle>
                <CardDescription>{email.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm font-medium mb-1">Gatilho:</p>
                  <p className="text-sm text-muted-foreground">{email.trigger}</p>
                </div>
                <div>
                  <p className="text-sm font-medium mb-1">Destinatários:</p>
                  <p className="text-sm text-muted-foreground">{email.recipients}</p>
                </div>
                <div>
                  <p className="text-sm font-medium mb-1">Serviço:</p>
                  <Badge variant="outline">{email.service}</Badge>
                </div>
                <div>
                  <p className="text-sm font-medium mb-1">Edge Function:</p>
                  <code className="text-xs bg-muted px-2 py-1 rounded">
                    {email.edgeFunction}
                  </code>
                </div>

                {email.canTest && (
                  <div className="pt-2">
                    <Button
                      onClick={() => openTestDialog(email.id)}
                      variant="outline"
                      size="sm"
                      className="w-full"
                      disabled={email.status !== 'configured'}
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Testar Email
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Documentation Section */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Documentação</CardTitle>
            <CardDescription>
              Informações sobre como os emails são enviados e configurados
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-medium mb-2">Emails via SMTP</h3>
              <p className="text-sm text-muted-foreground">
                Emails de boas-vindas, notificações administrativas e avisos de expiração
                usam a configuração SMTP definida em "Configuração SMTP". Certifique-se
                de que o servidor SMTP está corretamente configurado.
              </p>
            </div>
            <div>
              <h3 className="font-medium mb-2">Emails via Resend</h3>
              <p className="text-sm text-muted-foreground">
                Emails de recuperação de senha, contato e notificações de sincronização
                usam a API do Resend. A chave API deve estar configurada nos secrets.
              </p>
            </div>
            <div>
              <h3 className="font-medium mb-2">Notificações Automáticas</h3>
              <p className="text-sm text-muted-foreground">
                O sistema verifica automaticamente planos expirando todos os dias às 9h
                e envia avisos aos usuários 7 dias antes da expiração. Notificações de
                erro são enviadas automaticamente quando falhas ocorrem.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Test Email Dialog */}
        <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Testar Envio de Email</DialogTitle>
              <DialogDescription>
                Envie um email de teste para verificar se a configuração está funcionando corretamente.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="test-email">Email de Destino</Label>
                <Input
                  id="test-email"
                  type="email"
                  placeholder="seu@email.com"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  disabled={sendingTest}
                />
                <p className="text-sm text-muted-foreground">
                  Um email de teste será enviado para este endereço.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setTestDialogOpen(false)}
                disabled={sendingTest}
              >
                Cancelar
              </Button>
              <Button onClick={handleSendTestEmail} disabled={sendingTest}>
                {sendingTest ? "Enviando..." : "Enviar Teste"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default AdminEmails;
