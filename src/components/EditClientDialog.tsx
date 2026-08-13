import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface EditClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    plan: string;
    plan_end_at: string | null;
  };
  onSuccess: () => void;
}

const PLAN_LABELS: Record<string, string> = {
  START: "START (grátis)",
  PRO: "PRO",
  SPECIALIST: "SPECIALIST",
  WEALTH: "WEALTH (sob consulta)",
  // Valores legados — só para exibir clientes que já têm esse valor
  // histórico; nunca oferecidos como opção nova (ver dropdown abaixo).
  FREE: "FREE (legado)",
  FALE_C_ESPECIALISTA: "Consultoria (legado)",
};

const isFreePlanCode = (plan: string) => plan === "FREE" || plan === "START";

export function EditClientDialog({ open, onOpenChange, client, onSuccess }: EditClientDialogProps) {
  const [name, setName] = useState(client.name || "");
  const [email, setEmail] = useState(client.email || "");
  const [phone, setPhone] = useState(client.phone || "");
  const [newPlan, setNewPlan] = useState(client.plan);
  const [newEndDate, setNewEndDate] = useState(
    client.plan_end_at ? new Date(client.plan_end_at).toISOString().split("T")[0] : ""
  );
  const [isAdminChange, setIsAdminChange] = useState(true);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // Reset form when client changes
  useEffect(() => {
    setName(client.name || "");
    setEmail(client.email || "");
    setPhone(client.phone || "");
    setNewPlan(client.plan);
    setNewEndDate(client.plan_end_at ? new Date(client.plan_end_at).toISOString().split("T")[0] : "");
  }, [client]);

  const handleSubmit = () => {
    if (!name.trim()) {
      toast({
        title: "Erro",
        description: "O nome é obrigatório",
        variant: "destructive",
      });
      return;
    }
    if (!newPlan) {
      toast({
        title: "Erro",
        description: "Por favor, selecione um plano",
        variant: "destructive",
      });
      return;
    }
    setConfirmDialogOpen(true);
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      // Update profile data
      const profileUpdate: Record<string, unknown> = {
        name: name.trim(),
        phone: phone.trim() || null,
      };

      // Only update email if it changed (note: this only updates the profile, not auth)
      if (email !== client.email) {
        profileUpdate.email = email.trim();
      }

      // Handle plan changes
      const planChanged = newPlan !== client.plan;
      const endDateChanged = newEndDate !== (client.plan_end_at ? new Date(client.plan_end_at).toISOString().split("T")[0] : "");

      if (planChanged || endDateChanged) {
        profileUpdate.plan = newPlan;
        
        // plan_start_at é usada como evidência de plano pago (ver migration
        // 20260415120000_plan_model_v2.sql). Ao rebaixar para START (grátis),
        // limpa explicitamente em vez de deixar um valor antigo "pendurado"
        // (ex.: usuário que já foi PRO antes) — nunca carimba data nova para
        // um rebaixamento gratuito, e nunca deixa evidência de um plano pago
        // anterior sobrevivendo à mudança para o nível grátis.
        if (planChanged) {
          profileUpdate.plan_start_at = isFreePlanCode(newPlan) ? null : new Date().toISOString();
        }

        if (isFreePlanCode(newPlan)) {
          profileUpdate.plan_end_at = null;
        } else if (newEndDate) {
          profileUpdate.plan_end_at = new Date(newEndDate).toISOString();
        }
      }

      const { error } = await supabase
        .from("profiles")
        .update(profileUpdate)
        .eq("id", client.id);

      if (error) throw error;

      // Log audit if plan changed
      if (planChanged) {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from("admin_audit_log").insert({
          user_id: client.id,
          granted_by: user?.id || null,
          action: "admin_plan_change",
          old_plan: client.plan as any,
          new_plan: newPlan as any,
          metadata: JSON.stringify({
            change_type: isAdminChange ? "administrative" : "stripe_update",
            new_end_date: newEndDate || null,
            profile_updated: true,
            timestamp: new Date().toISOString(),
          }) as any,
        });

        // If not admin change, also update Stripe
        if (!isAdminChange) {
          const { data: stripeData, error: stripeError } = await supabase.functions.invoke("update-client-plan", {
            body: {
              userId: client.id,
              newPlan,
              newEndDate: newEndDate || null,
            },
          });

          if (stripeError) {
            console.error("Stripe update error:", stripeError);
            toast({
              title: "Aviso",
              description: "Dados atualizados localmente, mas houve erro ao sincronizar com Stripe.",
              variant: "destructive",
            });
          } else if (stripeData?.warning) {
            // Ex.: WEALTH concedido manualmente sobre assinatura Stripe ainda ativa.
            toast({
              title: "Atenção",
              description: stripeData.warning,
              variant: "destructive",
            });
          }
        }
      }

      toast({
        title: "Cliente atualizado",
        description: "Os dados do cliente foram atualizados com sucesso.",
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Erro ao atualizar cliente:", error);
      toast({
        title: "Erro ao atualizar cliente",
        description: error.message || "Ocorreu um erro ao processar a solicitação",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      setConfirmDialogOpen(false);
    }
  };

  const hasChanges = 
    name !== (client.name || "") ||
    email !== (client.email || "") ||
    phone !== (client.phone || "") ||
    newPlan !== client.plan ||
    newEndDate !== (client.plan_end_at ? new Date(client.plan_end_at).toISOString().split("T")[0] : "");

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar Cliente</DialogTitle>
            <DialogDescription>
              Atualize as informações do cliente. Alterações no email não afetam as credenciais de login.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="client-name">Nome *</Label>
              <Input
                id="client-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome completo"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="client-email">Email</Label>
              <Input
                id="client-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@exemplo.com"
              />
              <p className="text-xs text-muted-foreground">
                Alterar o email aqui não muda as credenciais de login do usuário.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="client-phone">Telefone</Label>
              <Input
                id="client-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(00) 00000-0000"
              />
            </div>

            <div className="border-t pt-4 space-y-4">
              <div className="space-y-2">
                <Label>Plano Atual</Label>
                <Input 
                  value={PLAN_LABELS[client.plan] || client.plan} 
                  disabled 
                  className="bg-muted" 
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-plan">Novo Plano</Label>
                <Select value={newPlan} onValueChange={setNewPlan}>
                  <SelectTrigger id="new-plan">
                    <SelectValue placeholder="Selecione o plano" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="START">START (grátis)</SelectItem>
                    <SelectItem value="PRO">PRO</SelectItem>
                    <SelectItem value="SPECIALIST">SPECIALIST</SelectItem>
                    <SelectItem value="WEALTH">WEALTH (sob consulta)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {!isFreePlanCode(newPlan) && (
                <div className="space-y-2">
                  <Label htmlFor="end-date">Data de Expiração</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={newEndDate}
                    onChange={(e) => setNewEndDate(e.target.value)}
                  />
                </div>
              )}

              {newPlan !== client.plan && (
                <div className="space-y-3 pt-2 border-t">
                  <Label className="text-sm font-medium">Tipo de Alteração de Plano</Label>
                  
                  <div className="flex items-start space-x-2">
                    <Checkbox
                      id="admin-change"
                      checked={isAdminChange}
                      onCheckedChange={(checked) => setIsAdminChange(!!checked)}
                    />
                    <div className="grid gap-1 leading-none">
                      <label
                        htmlFor="admin-change"
                        className="text-sm font-medium leading-none cursor-pointer"
                      >
                        Alteração administrativa (sem cobrança)
                      </label>
                      <p className="text-xs text-muted-foreground">
                        Apenas atualiza os dados no banco interno.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-2">
                    <Checkbox
                      id="stripe-update"
                      checked={!isAdminChange}
                      onCheckedChange={(checked) => setIsAdminChange(!checked)}
                    />
                    <div className="grid gap-1 leading-none">
                      <label
                        htmlFor="stripe-update"
                        className="text-sm font-medium leading-none cursor-pointer"
                      >
                        Atualizar também na Stripe
                      </label>
                      <p className="text-xs text-muted-foreground">
                        Sincroniza com a Stripe e gera cobrança se aplicável.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting || !hasChanges}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar Alterações"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Alterações</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 pt-2">
                <p>Tem certeza que deseja salvar as alterações para <strong>{name || email}</strong>?</p>
                
                {newPlan !== client.plan && (
                  <>
                    <p className="pt-2">
                      <strong>Alteração de plano:</strong> {PLAN_LABELS[client.plan] || client.plan} → {PLAN_LABELS[newPlan] || newPlan}
                    </p>
                    <p>
                      <strong>Tipo:</strong> {isAdminChange ? "Administrativa (sem cobrança)" : "Atualização Stripe"}
                    </p>
                  </>
                )}

                {newEndDate && !isFreePlanCode(newPlan) && newEndDate !== (client.plan_end_at ? new Date(client.plan_end_at).toISOString().split("T")[0] : "") && (
                  <p>
                    <strong>Nova data de expiração:</strong> {new Date(newEndDate).toLocaleDateString("pt-BR")}
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
