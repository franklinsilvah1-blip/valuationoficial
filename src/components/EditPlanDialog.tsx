import { useState } from "react";
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

interface EditPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: {
    id: string;
    name: string;
    email: string;
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
  // Valores legados — só para exibir clientes com esse valor histórico.
  FREE: "FREE (legado)",
  FALE_C_ESPECIALISTA: "Consultoria (legado)",
};

const isFreePlanCode = (plan: string) => plan === "FREE" || plan === "START";

export function EditPlanDialog({ open, onOpenChange, client, onSuccess }: EditPlanDialogProps) {
  const [newPlan, setNewPlan] = useState(client.plan);
  const [newEndDate, setNewEndDate] = useState(
    client.plan_end_at ? new Date(client.plan_end_at).toISOString().split("T")[0] : ""
  );
  const [isAdminChange, setIsAdminChange] = useState(true);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = () => {
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
      if (isAdminChange) {
        // Alteração administrativa - apenas atualiza o banco local.
        // plan_start_at é evidência de plano pago para o backfill de
        // grandfathering (20260415120000_plan_model_v2.sql) — nunca carimba
        // data nova ao rebaixar para START (grátis), e limpa qualquer valor
        // anterior para não deixar evidência de um plano pago sobrevivendo à
        // mudança para o nível grátis.
        const updateData: any = {
          plan: newPlan,
          plan_start_at: isFreePlanCode(newPlan) ? null : new Date().toISOString(),
        };

        if (isFreePlanCode(newPlan)) {
          updateData.plan_end_at = null;
        } else if (newEndDate) {
          updateData.plan_end_at = new Date(newEndDate).toISOString();
        }

        const { error } = await supabase
          .from("profiles")
          .update(updateData)
          .eq("id", client.id);

        if (error) throw error;

        // Registrar no histórico de auditoria
        const { data: { user } } = await supabase.auth.getUser();
        const { error: auditError } = await supabase.from("admin_audit_log").insert({
          user_id: client.id,
          granted_by: user?.id || null,
          action: "admin_plan_change",
          old_plan: client.plan as any,
          new_plan: newPlan as any,
          metadata: JSON.stringify({
            change_type: "administrative",
            new_end_date: newEndDate || null,
            timestamp: new Date().toISOString(),
          }) as any,
        });

        if (auditError) {
          console.error("Failed to create audit log:", auditError);
        }

        toast({
          title: "Plano atualizado",
          description: `Plano alterado para ${PLAN_LABELS[newPlan as keyof typeof PLAN_LABELS]} (alteração administrativa)`,
        });
      } else {
        // Atualizar também na Stripe
        const { data, error } = await supabase.functions.invoke("update-client-plan", {
          body: {
            userId: client.id,
            newPlan,
            newEndDate: newEndDate || null,
          },
        });

        if (error) throw error;

        if (data?.warning) {
          toast({
            title: "Atenção",
            description: data.warning,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Plano atualizado",
            description: `Plano alterado para ${PLAN_LABELS[newPlan as keyof typeof PLAN_LABELS]} e atualizado na Stripe`,
          });
        }
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Erro ao atualizar plano:", error);
      toast({
        title: "Erro ao atualizar plano",
        description: error.message || "Ocorreu um erro ao processar a solicitação",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      setConfirmDialogOpen(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar Plano do Cliente</DialogTitle>
            <DialogDescription>
              Altere o plano de assinatura do cliente. Escolha entre alteração administrativa ou atualização via Stripe.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome do Cliente</Label>
              <Input value={client.name || client.email} disabled className="bg-muted" />
            </div>

            <div className="space-y-2">
              <Label>Plano Atual</Label>
              <Input 
                value={PLAN_LABELS[client.plan as keyof typeof PLAN_LABELS]} 
                disabled 
                className="bg-muted" 
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-plan">Novo Plano *</Label>
              <Select value={newPlan} onValueChange={setNewPlan}>
                <SelectTrigger id="new-plan">
                  <SelectValue placeholder="Selecione o novo plano" />
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
                <Label htmlFor="end-date">Nova Data de Expiração (opcional)</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={newEndDate}
                  onChange={(e) => setNewEndDate(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-3 pt-2 border-t">
              <Label className="text-base">Tipo de Alteração *</Label>
              
              <div className="flex items-start space-x-2">
                <Checkbox
                  id="admin-change"
                  checked={isAdminChange}
                  onCheckedChange={(checked) => {
                    setIsAdminChange(!!checked);
                  }}
                />
                <div className="grid gap-1.5 leading-none">
                  <label
                    htmlFor="admin-change"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Alteração administrativa (sem cobrança)
                  </label>
                  <p className="text-sm text-muted-foreground">
                    Apenas atualiza os dados no banco interno. Nenhuma cobrança é gerada.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-2">
                <Checkbox
                  id="stripe-update"
                  checked={!isAdminChange}
                  onCheckedChange={(checked) => {
                    setIsAdminChange(!checked);
                  }}
                />
                <div className="grid gap-1.5 leading-none">
                  <label
                    htmlFor="stripe-update"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Atualizar também na Stripe (com cobrança)
                  </label>
                  <p className="text-sm text-muted-foreground">
                    Atualiza o plano na Stripe e envia e-mail de confirmação ao cliente.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
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
            <AlertDialogTitle>Confirmar Alteração de Plano</AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-2 pt-2">
                <p>
                  Tem certeza que deseja alterar o plano de <strong>{client.name || client.email}</strong> para{" "}
                  <strong>{PLAN_LABELS[newPlan as keyof typeof PLAN_LABELS]}</strong>?
                </p>
                <p className="pt-2">
                  <strong>Tipo de alteração:</strong>{" "}
                  {isAdminChange ? "Administrativa (sem cobrança)" : "Atualização Stripe (com cobrança)"}
                </p>
                {newEndDate && !isFreePlanCode(newPlan) && (
                  <p>
                    <strong>Nova data de expiração:</strong>{" "}
                    {new Date(newEndDate).toLocaleDateString("pt-BR")}
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={isSubmitting}>
              {isSubmitting ? "Processando..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
