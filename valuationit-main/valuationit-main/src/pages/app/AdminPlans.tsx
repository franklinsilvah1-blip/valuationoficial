import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { useSubscriptionPlans, useUpdateSubscriptionPlan, SubscriptionPlan } from "@/hooks/useSubscriptionPlans";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CreditCard, Edit, Save, X, DollarSign, List, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const AdminPlans = () => {
  const { isAdmin, loading: adminLoading } = useAdminCheck();
  const { data: plans, isLoading: plansLoading } = useSubscriptionPlans();
  const updatePlan = useUpdateSubscriptionPlan();
  const { toast } = useToast();
  
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [formData, setFormData] = useState<Partial<SubscriptionPlan>>({});
  const [validationError, setValidationError] = useState<string | null>(null);

  // Planos que não precisam de stripe_price_id (gratuitos ou consultoria)
  const isFreePlan = (planCode: string | undefined) => {
    return planCode === "FREE" || planCode === "WEALTH";
  };

  const validateForm = (): boolean => {
    setValidationError(null);
    
    // Verifica se é um plano pago que precisa de stripe_price_id
    const isPaidPlan = !isFreePlan(editingPlan?.plan_code) && (formData.price_quarterly || 0) > 0;
    
    if (isPaidPlan && !formData.stripe_price_id?.trim()) {
      setValidationError("Planos pagos precisam ter um Stripe Price ID configurado para processar pagamentos.");
      return false;
    }
    
    return true;
  };

  if (adminLoading || plansLoading) {
    return (
      <AppLayout title="Gerenciar Planos">
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </AppLayout>
    );
  }

  if (!isAdmin) {
    return (
      <AppLayout title="Acesso Negado">
        <p>Você não tem permissão para acessar esta página.</p>
      </AppLayout>
    );
  }

  const openEditDialog = (plan: SubscriptionPlan) => {
    setEditingPlan(plan);
    setValidationError(null);
    setFormData({
      id: plan.id,
      display_name: plan.display_name,
      description: plan.description || "",
      price_quarterly: plan.price_quarterly,
      price_note: plan.price_note || "",
      stripe_price_id: plan.stripe_price_id || "",
      features: plan.features,
      is_active: plan.is_active,
      sort_order: plan.sort_order,
    });
  };

  const handleSave = async () => {
    if (!formData.id) return;
    
    if (!validateForm()) {
      toast({
        title: "Erro de validação",
        description: "Corrija os erros antes de salvar.",
        variant: "destructive",
      });
      return;
    }
    
    await updatePlan.mutateAsync({
      id: formData.id,
      display_name: formData.display_name,
      description: formData.description,
      price_quarterly: formData.price_quarterly,
      price_note: formData.price_note,
      stripe_price_id: formData.stripe_price_id || null,
      features: formData.features,
      is_active: formData.is_active,
      sort_order: formData.sort_order,
    });
    
    setEditingPlan(null);
    setValidationError(null);
  };

  const handleFeatureChange = (index: number, value: string) => {
    const newFeatures = [...(formData.features || [])];
    newFeatures[index] = value;
    setFormData({ ...formData, features: newFeatures });
  };

  const addFeature = () => {
    setFormData({ ...formData, features: [...(formData.features || []), ""] });
  };

  const removeFeature = (index: number) => {
    const newFeatures = (formData.features || []).filter((_, i) => i !== index);
    setFormData({ ...formData, features: newFeatures });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  return (
    <AppLayout title="Gerenciar Planos">
      <div className="space-y-6">
        {/* Header Info */}
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <DollarSign className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200">Importante sobre preços</p>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Os preços exibidos aqui são para referência na interface. O valor real cobrado é definido no Stripe 
                  através do <code className="bg-amber-200/50 px-1 rounded">stripe_price_id</code>. 
                  Para alterar o preço real, você precisa criar um novo preço no Stripe.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Plans Grid */}
        <div className="grid gap-6">
          {plans?.map((plan) => (
            <Card key={plan.id} className={!plan.is_active ? "opacity-60" : ""}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <CreditCard className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {plan.display_name}
                      <Badge variant="outline" className="ml-2 font-mono text-xs">
                        {plan.plan_code}
                      </Badge>
                      {!plan.is_active && (
                        <Badge variant="secondary">Inativo</Badge>
                      )}
                    </CardTitle>
                    <CardDescription>{plan.description}</CardDescription>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => openEditDialog(plan)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Editar
                </Button>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Pricing */}
                  <div>
                    <Label className="text-muted-foreground text-xs uppercase tracking-wide">Preço Trimestral</Label>
                    <p className="text-2xl font-bold text-primary mt-1">
                      {formatCurrency(plan.price_quarterly)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatCurrency(plan.price_quarterly / 3)}/mês
                    </p>
                    {plan.price_note && (
                      <p className="text-xs text-muted-foreground mt-2">{plan.price_note}</p>
                    )}
                  </div>

                  {/* Stripe Price ID */}
                  <div>
                    <Label className="text-muted-foreground text-xs uppercase tracking-wide">Stripe Price ID</Label>
                    <p className="font-mono text-sm mt-1 break-all">
                      {plan.stripe_price_id || <span className="text-muted-foreground">Não configurado</span>}
                    </p>
                  </div>

                  {/* Features */}
                  <div>
                    <Label className="text-muted-foreground text-xs uppercase tracking-wide">Features ({plan.features?.length || 0})</Label>
                    <ul className="mt-1 space-y-1">
                      {plan.features?.slice(0, 3).map((feature, idx) => (
                        <li key={idx} className="text-sm truncate">• {feature}</li>
                      ))}
                      {(plan.features?.length || 0) > 3 && (
                        <li className="text-sm text-muted-foreground">
                          +{plan.features.length - 3} mais...
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingPlan} onOpenChange={() => setEditingPlan(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Editar Plano: {editingPlan?.display_name}
            </DialogTitle>
            <DialogDescription>
              Atualize as informações do plano. As alterações serão refletidas imediatamente na interface.
            </DialogDescription>
          </DialogHeader>

          {validationError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{validationError}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="display_name">Nome de Exibição</Label>
                <Input
                  id="display_name"
                  value={formData.display_name || ""}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sort_order">Ordem</Label>
                <Input
                  id="sort_order"
                  type="number"
                  value={formData.sort_order || 0}
                  onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Input
                id="description"
                value={formData.description || ""}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Para investidores iniciantes"
              />
            </div>

            {/* Pricing */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price_quarterly">Preço Trimestral (R$)</Label>
                <Input
                  id="price_quarterly"
                  type="number"
                  step="0.01"
                  value={formData.price_quarterly || 0}
                  onChange={(e) => setFormData({ ...formData, price_quarterly: parseFloat(e.target.value) })}
                />
                <p className="text-xs text-muted-foreground">
                  Equivale a {formatCurrency((formData.price_quarterly || 0) / 3)}/mês
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="stripe_price_id" className="flex items-center gap-2">
                  Stripe Price ID
                  {!isFreePlan(editingPlan?.plan_code) && (formData.price_quarterly || 0) > 0 && (
                    <Badge variant="outline" className="text-xs">Obrigatório</Badge>
                  )}
                </Label>
                <Input
                  id="stripe_price_id"
                  value={formData.stripe_price_id || ""}
                  onChange={(e) => {
                    setFormData({ ...formData, stripe_price_id: e.target.value });
                    setValidationError(null);
                  }}
                  placeholder="price_xxx"
                  className={`font-mono ${validationError ? "border-destructive" : ""}`}
                />
                {!isFreePlan(editingPlan?.plan_code) && (formData.price_quarterly || 0) > 0 && !formData.stripe_price_id?.trim() && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Este plano é pago e precisa de um Stripe Price ID para funcionar
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="price_note">Nota de Cobrança</Label>
              <Input
                id="price_note"
                value={formData.price_note || ""}
                onChange={(e) => setFormData({ ...formData, price_note: e.target.value })}
                placeholder="Cobrado trimestralmente (R$ xxx a cada 3 meses)"
              />
            </div>

            {/* Features */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <List className="h-4 w-4" />
                  Features
                </Label>
                <Button type="button" variant="outline" size="sm" onClick={addFeature}>
                  + Adicionar
                </Button>
              </div>
              <div className="space-y-2">
                {formData.features?.map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      value={feature}
                      onChange={(e) => handleFeatureChange(idx, e.target.value)}
                      placeholder="Descrição da feature"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFeature(idx)}
                      className="shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Active Status */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label htmlFor="is_active">Plano Ativo</Label>
                <p className="text-sm text-muted-foreground">
                  Planos inativos não aparecem para os usuários
                </p>
              </div>
              <Switch
                id="is_active"
                checked={formData.is_active || false}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPlan(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={updatePlan.isPending}>
              <Save className="h-4 w-4 mr-2" />
              {updatePlan.isPending ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default AdminPlans;
