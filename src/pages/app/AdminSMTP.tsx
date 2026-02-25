import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAdminCheck } from "@/hooks/useAdminCheck";

const AdminSMTP = () => {
  const { isAdmin, loading: adminLoading } = useAdminCheck();
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState({
    smtp_server: "",
    smtp_port: 587,
    smtp_user: "",
    smtp_password: "",
    sender_name: "",
    sender_email: "",
    security_type: "TLS",
  });

  useEffect(() => {
    if (!adminLoading && isAdmin) {
      loadConfig();
    }
  }, [adminLoading, isAdmin]);

  // Don't render while checking permissions
  if (adminLoading || !isAdmin) {
    return null;
  }

  const loadConfig = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("get-smtp-config");

      if (error) throw error;

      if (data?.config) {
        setConfig({
          ...data.config,
          smtp_password: "", // Password is never loaded from server for security
        });
      }
    } catch (error) {
      console.error("Erro ao carregar configuração:", error);
    }
  };

  const handleSave = async () => {
    // Validate password is provided
    if (!config.smtp_password || config.smtp_password.trim() === "") {
      toast.error("A senha SMTP é obrigatória");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("save-smtp-config", {
        body: config
      });

      if (error) throw error;

      toast.success("Configurações SMTP salvas com sucesso!");
      
      // Clear password field after save for security
      setConfig(prev => ({ ...prev, smtp_password: "" }));
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast.error("Erro ao salvar configurações SMTP");
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error("Usuário não autenticado");

      const { error } = await supabase.functions.invoke("test-smtp", {
        body: { testEmail: user.email }
      });

      if (error) throw error;
      
      toast.success("E-mail de teste enviado! Verifique sua caixa de entrada.");
    } catch (error) {
      console.error("Erro ao testar:", error);
      toast.error("Erro ao enviar e-mail de teste");
    } finally {
      setLoading(false);
    }
  };

  const handleTestWelcome = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase.functions.invoke("send-welcome-email", {
        body: { userId: user.id, plan: "START" }
      });

      if (error) throw error;
      
      toast.success("E-mail de boas-vindas enviado! Verifique sua caixa de entrada.");
    } catch (error) {
      console.error("Erro ao testar:", error);
      toast.error("Erro ao enviar e-mail de boas-vindas");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout title="Configurações SMTP">
      <div className="container mx-auto p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Configurações de E-mail (SMTP)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
              <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">ℹ️ Informações Importantes</h4>
              <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                <li>• Configure o SMTP antes de testar o envio de e-mails</li>
                <li>• E-mails de boas-vindas são enviados automaticamente quando um usuário assina um plano pago</li>
                <li>• Use o botão "Testar" para verificar se a configuração está correta</li>
                <li>• Exemplos comuns: Gmail (smtp.gmail.com:587), SendGrid, Amazon SES</li>
              </ul>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="smtp_server">Servidor SMTP</Label>
                <Input
                  id="smtp_server"
                  value={config.smtp_server}
                  onChange={(e) => setConfig({ ...config, smtp_server: e.target.value })}
                  placeholder="smtp.exemplo.com"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="smtp_port">Porta</Label>
                <Input
                  id="smtp_port"
                  type="number"
                  value={config.smtp_port}
                  onChange={(e) => setConfig({ ...config, smtp_port: parseInt(e.target.value) })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="smtp_user">Usuário</Label>
                <Input
                  id="smtp_user"
                  value={config.smtp_user}
                  onChange={(e) => setConfig({ ...config, smtp_user: e.target.value })}
                  placeholder="usuario@exemplo.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="smtp_password">Senha</Label>
                <Input
                  id="smtp_password"
                  type="password"
                  value={config.smtp_password}
                  onChange={(e) => setConfig({ ...config, smtp_password: e.target.value })}
                  placeholder={config.smtp_server ? "Digite para alterar a senha" : "Digite a senha SMTP"}
                />
                <p className="text-xs text-muted-foreground">
                  Por segurança, a senha nunca é exibida após ser salva
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sender_name">Nome do Remetente</Label>
                <Input
                  id="sender_name"
                  value={config.sender_name}
                  onChange={(e) => setConfig({ ...config, sender_name: e.target.value })}
                  placeholder="Minha Empresa"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sender_email">E-mail do Remetente</Label>
                <Input
                  id="sender_email"
                  type="email"
                  value={config.sender_email}
                  onChange={(e) => setConfig({ ...config, sender_email: e.target.value })}
                  placeholder="contato@exemplo.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="security_type">Tipo de Segurança</Label>
                <Select 
                  value={config.security_type} 
                  onValueChange={(value) => setConfig({ ...config, security_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    <SelectItem value="SSL">SSL</SelectItem>
                    <SelectItem value="TLS">TLS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <Button onClick={handleSave} disabled={loading}>
                {loading ? "Salvando..." : "Salvar Configurações"}
              </Button>
              <Button onClick={handleTest} variant="outline" disabled={loading}>
                Testar Envio Simples
              </Button>
              <Button onClick={handleTestWelcome} variant="outline" disabled={loading}>
                Testar E-mail de Boas-vindas
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default AdminSMTP;
