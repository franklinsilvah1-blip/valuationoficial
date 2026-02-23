import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import InvestorProfileModal from "@/components/InvestorProfileModal";
import DeleteAccountDialog from "@/components/DeleteAccountDialog";
import PaymentHistory from "@/components/PaymentHistory";
import { AppLayout } from "@/components/AppLayout";
import PlanCard from "@/components/PlanCard";
import ContactSpecialistDialog from "@/components/ContactSpecialistDialog";
import { TwoFactorSettings } from "@/components/TwoFactorSettings";
import NotificationSettings from "@/components/NotificationSettings";
import { Check, RefreshCw } from "lucide-react";
import { getPlanDisplayName } from "@/utils/planHelpers";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { User, CreditCard, Shield, AlertTriangle } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSubscriptionPlans } from "@/hooks/useSubscriptionPlans";

interface Option {
  id: string;
  text: string;
  weight_start: number;
  weight_pro: number;
  weight_specialist: number;
}

interface Question {
  id: string;
  text: string;
  order_num: number;
  options: Option[];
}

const Perfil = () => {
  const { user, userPlan, subscriptionData, refreshSubscription } = useAuth();
  const [syncing, setSyncing] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const initialTab = (location.state as any)?.tab || "personal";
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [investorProfile, setInvestorProfile] = useState<string | null>(null);
  const [lastReclassification, setLastReclassification] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [showContactDialog, setShowContactDialog] = useState(false);

  // Fetch plans from database
  const { data: dbPlans } = useSubscriptionPlans();

  // Mostrar plano de teste apenas para usuários específicos
  const TEST_USERS = ["contato@dradigital.com.br", "franklinsilvah1@gmail.com"];
  const isTestUser = user?.email && TEST_USERS.includes(user.email);

  // Transform database plans to UI format
  interface PlanUI {
    name: string;
    description: string;
    price: string;
    period: string;
    billingNote?: string;
    features: string[];
    highlighted: boolean;
    consultOnly?: boolean;
  }

  const plans = useMemo((): PlanUI[] => {
    // Default FREE plan (not in database)
    const freePlan: PlanUI = {
      name: "FREE",
      description: "",
      price: "Experimente grátis!",
      period: "",
      features: [
        "Visualização de até 3 ativos por dia",
        "Acesso básico ao Mercado",
        "Análises resumidas de ativos",
        "Análise de perfil investidor"
      ],
      highlighted: false
    };

    if (!dbPlans || dbPlans.length === 0) {
      // Fallback to hardcoded plans if database is empty
      const basePlans: PlanUI[] = [
        freePlan,
        {
          name: "START",
          description: "Para investidores iniciantes",
          price: "R$ 49",
          period: "mês",
          billingNote: "Cobrado trimestralmente (R$ 147,00 a cada 3 meses)",
          features: [
            "Acesso completo a plataforma",
            "Análises detalhadas de ativos",
            "Carteiras recomendadas START",
            "Acesso à Conteúdos exclusivos",
            "Suporte por email"
          ],
          highlighted: false
        },
        {
          name: "PRO",
          description: "Para investidores intermediários",
          price: "R$ 99",
          period: "mês",
          billingNote: "Cobrado trimestralmente (R$ 297,00 a cada 3 meses)",
          features: [
            "Todos os benefícios do START",
            "Análises avançadas de ativos",
            "Carteiras recomendadas PRO",
            "Suporte por chat",
            "Consultoria com Especialista"
          ],
          highlighted: true
        },
        {
          name: "SPECIALIST",
          description: "Para investidores Profissionais",
          price: "R$ 199",
          period: "mês",
          billingNote: "Cobrado trimestralmente (R$ 597,00 a cada 3 meses)",
          features: [
            "Todos os benefícios do PRO",
            "Análises personalizadas de ativos",
            "Carteiras recomendadas SPECIALIST",
            "Suporte prioritário",
            "Método X Valuation",
            "Mentoria THE SPECIALISTS"
          ],
          highlighted: false
        },
        {
          name: "WEALTH",
          description: "Para investidores e empresários",
          price: "Consulte",
          period: "",
          features: [
            "Todos os benefícios do SPECIALIST",
            "Estratégia personalizada",
            "Ampliação inteligente de patrimônio",
            "Blindagem estratégica da riqueza",
            "Mentoria exclusiva para investidores e empresas"
          ],
          highlighted: false,
          consultOnly: true
        }
      ];
      
      if (isTestUser) {
        basePlans.push({
          name: "TESTE",
          description: "Plano de teste - apenas para desenvolvimento",
          price: "R$ 2",
          period: "dia",
          billingNote: "Cobrança diária para testes",
          features: ["Acesso de teste", "Cobrança diária de R$ 2,00", "Apenas para validação"],
          highlighted: false
        });
      }
      
      return basePlans;
    }

    // Transform database plans (exclude FREE since we add it manually)
    const transformedPlans = dbPlans
      .filter((dbPlan) => dbPlan.plan_code !== "FREE")
      .map((dbPlan) => {
        const monthlyPrice = Math.round(dbPlan.price_quarterly / 3);
        const isWealth = dbPlan.plan_code === "WEALTH";
        
        return {
          name: dbPlan.plan_code,
          description: dbPlan.description || "",
          price: isWealth ? "Consulte" : `R$ ${monthlyPrice}`,
          period: isWealth ? "" : "mês",
          billingNote: dbPlan.price_note || undefined,
          features: dbPlan.features || [],
          highlighted: dbPlan.plan_code === "PRO",
          consultOnly: isWealth
        };
      });

    const allPlans = [freePlan, ...transformedPlans];
    
    // Adicionar plano TESTE para usuários de teste
    if (isTestUser) {
      allPlans.push({
        name: "TESTE",
        description: "Plano de teste - apenas para desenvolvimento",
        price: "R$ 2",
        period: "dia",
        billingNote: "Cobrança diária para testes",
        features: ["Acesso de teste", "Cobrança diária de R$ 2,00", "Apenas para validação"],
        highlighted: false
      });
    }

    return allPlans;
  }, [dbPlans, isTestUser]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setEmail(user.email || "");

      const { data: profile } = await supabase
        .from("profiles")
        .select("name, phone, investor_profile, last_reclassification_at")
        .eq("id", user.id)
        .single();

      if (profile) {
        setName(profile.name || "");
        setPhone(profile.phone || "");
        setInvestorProfile(profile.investor_profile);
        setLastReclassification(profile.last_reclassification_at);
      }

      // Load questions
      const { data: questionsData, error: questionsError } = await supabase
        .from("profile_questions")
        .select("*")
        .order("order_num");

      if (questionsError) throw questionsError;

      const { data: optionsData, error: optionsError } = await supabase
        .from("profile_options")
        .select("*");

      if (optionsError) throw optionsError;

      const questionsWithOptions = questionsData.map((q) => ({
        ...q,
        options: optionsData.filter((o) => o.question_id === q.id),
      }));

      setQuestions(questionsWithOptions);

      // Check if needs to show modal on first access
      if (!profile?.investor_profile) {
        setShowModal(true);
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar perfil");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Update profile (name and phone)
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ name, phone })
        .eq("id", user.id);

      if (profileError) throw profileError;

      // Update email if changed
      if (email !== user.email) {
        const { error: emailError } = await supabase.auth.updateUser({ email });
        if (emailError) throw emailError;
        toast.info("Um e-mail de confirmação foi enviado para o novo endereço");
      }

      toast.success("Perfil atualizado com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar perfil:", error);
      toast.error("Erro ao atualizar perfil");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast.error("Preencha ambos os campos de senha");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    setSaving(true);
    try {
      const { error: passwordError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (passwordError) throw passwordError;
      
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Senha atualizada com sucesso!");
    } catch (error) {
      console.error("Erro ao atualizar senha:", error);
      toast.error("Erro ao atualizar senha");
    } finally {
      setSaving(false);
    }
  };

  const handleCompleteOnboarding = () => {
    loadData();
  };

  const canReclassify = () => {
    if (!lastReclassification) return false;
    const daysSinceLastClassification = differenceInDays(
      new Date(),
      new Date(lastReclassification)
    );
    return daysSinceLastClassification >= 90;
  };

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case "START":
        return "bg-green-500";
      case "PRO":
        return "bg-blue-500";
      case "SPECIALIST":
        return "bg-purple-500";
      default:
        return "bg-gray-500";
    }
  };

  const getProfileColor = (profile: string) => {
    switch (profile) {
      case "START":
        return "bg-green-500";
      case "PRO":
        return "bg-blue-500";
      case "SPECIALIST":
        return "bg-purple-500";
      default:
        return "bg-gray-500";
    }
  };

  const handleManageSubscription = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');
      
      if (error) throw error;
      
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Erro ao acessar portal do cliente:', error);
      toast.error('Erro ao acessar gerenciamento de assinatura');
    }
  };

  const handleSyncSubscription = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('force-sync-subscription');
      
      if (error) throw error;
      
      if (data?.success) {
        await refreshSubscription();
        toast.success(`Plano sincronizado: ${data.plan || userPlan}`);
      } else {
        toast.error(data?.error || "Erro ao sincronizar plano");
      }
    } catch (error: any) {
      console.error("Erro ao sincronizar plano:", error);
      toast.error("Erro ao sincronizar plano. Tente novamente.");
    } finally {
      setSyncing(false);
    }
  };

  const handleSubscribe = async (planName: string) => {
    if (planName === userPlan) {
      return; // Já está no plano atual
    }

    // WEALTH abre diálogo de contato
    if (planName === "WEALTH") {
      setShowContactDialog(true);
      return;
    }

    setLoadingPlan(planName);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { plan: planName }
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error: any) {
      console.error("Erro ao criar checkout:", error);
      toast.error(error.message || "Não foi possível iniciar o processo de assinatura. Tente novamente.");
    } finally {
      setLoadingPlan(null);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-32 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <AppLayout title="Minha Conta">
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Meu Perfil</h1>

        <Tabs defaultValue={initialTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="personal" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Dados Pessoais
            </TabsTrigger>
            <TabsTrigger value="subscription" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Assinatura
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Segurança
            </TabsTrigger>
            <TabsTrigger value="danger" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Zona de Perigo
            </TabsTrigger>
          </TabsList>

          {/* Dados Pessoais */}
          <TabsContent value="personal" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Informações Pessoais</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(00) 00000-0000"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                  />
                  <p className="text-sm text-muted-foreground">
                    Ao alterar o e-mail, você receberá uma confirmação no novo endereço
                  </p>
                </div>
                
                {investorProfile && (
                  <div className="space-y-2">
                    <Label>Perfil de Investidor</Label>
                    <div className="flex items-center gap-2">
                      <Badge className={getProfileColor(investorProfile)}>
                        {investorProfile}
                      </Badge>
                      {lastReclassification && (
                        <span className="text-sm text-muted-foreground">
                          Última atualização: {format(new Date(lastReclassification), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <Button onClick={handleSaveProfile} disabled={saving}>
                  {saving ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </CardContent>
            </Card>

            {/* Investor Profile Questionnaire */}
            <Card>
              <CardHeader>
                <CardTitle>Questionário de Perfil de Investidor</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!investorProfile ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-4">
                      Você ainda não respondeu o questionário de perfil de investidor.
                    </p>
                    <Button onClick={() => setShowModal(true)}>
                      Responder Questionário
                    </Button>
                  </div>
                ) : canReclassify() ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-4">
                      Já se passaram 90 dias desde sua última classificação. Responda novamente para atualizar seu perfil.
                    </p>
                    <Button onClick={() => setShowModal(true)}>
                      Atualizar Perfil
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">
                      Você poderá reclassificar seu perfil novamente em{" "}
                      {90 - differenceInDays(new Date(), new Date(lastReclassification!))} dias
                      {userPlan !== "START" && " ou a qualquer momento através do plano PRO ou SPECIALIST"}.
                    </p>
                    {userPlan !== "START" && (
                      <Button onClick={() => setShowModal(true)} className="mt-4">
                        Reclassificar Agora
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Assinatura */}
          <TabsContent value="subscription" className="space-y-6">
            {/* Planos Disponíveis */}
            <Card className="mt-8">
              <CardHeader>
                <CardTitle>Planos Disponíveis</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Compare e escolha o melhor plano para você
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {plans.map((plan, index) => {
                    const isCurrentPlan = plan.name === userPlan;

                    return (
                      <div key={index} className="relative">
                        {isCurrentPlan && (
                          <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                            <Badge className="bg-green-500 hover:bg-green-600 text-white">
                              Seu Plano
                            </Badge>
                          </div>
                        )}
                        <PlanCard
                          name={getPlanDisplayName(plan.name)}
                          description={plan.description}
                          price={plan.price}
                          period={plan.period}
                          billingNote={plan.billingNote}
                          features={plan.features}
                          highlighted={plan.highlighted}
                          consultOnly={plan.consultOnly}
                          isCurrentPlan={isCurrentPlan}
                          onSubscribe={() => handleSubscribe(plan.name)}
                          loading={loadingPlan === plan.name}
                        />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Histórico de Pagamentos */}
            <PaymentHistory />

            {/* Gerenciamento de Pagamento */}
            {userPlan && userPlan !== "FREE" && (
              <Card>
                <CardHeader>
                  <CardTitle>Gerenciamento de Pagamento</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Use o portal do Stripe para alterar forma de pagamento, visualizar faturas ou cancelar sua assinatura.
                  </p>
                  <Button 
                    variant="outline" 
                    onClick={handleManageSubscription}
                    className="w-full"
                  >
                    Abrir Portal de Pagamento
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Sincronizar Plano */}
            <Card>
              <CardHeader>
                <CardTitle>Sincronizar Plano</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Se o seu plano não está refletindo corretamente, use este botão para sincronizar com o sistema de pagamentos.
                </p>
                <Button 
                  variant="outline" 
                  onClick={handleSyncSubscription}
                  disabled={syncing}
                  className="w-full"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
                  {syncing ? "Sincronizando..." : "Sincronizar Plano"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Segurança */}
          <TabsContent value="security" className="space-y-6">
            {/* 2FA Settings */}
            <TwoFactorSettings />

            {/* Push Notifications */}
            <NotificationSettings />

            <Card>
              <CardHeader>
                <CardTitle>Alterar Senha</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">Nova Senha</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirme a senha"
                  />
                </div>

                <Button 
                  onClick={handleUpdatePassword} 
                  disabled={saving || !newPassword || !confirmPassword}
                >
                  {saving ? "Salvando..." : "Atualizar Senha"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Zona de Perigo */}
          <TabsContent value="danger" className="space-y-6">
            <Card className="border-destructive">
              <CardHeader>
                <CardTitle className="text-destructive flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Zona de Perigo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 space-y-3">
                  <h3 className="font-semibold text-destructive">Deletar Conta</h3>
                  <p className="text-sm text-muted-foreground">
                    Ao deletar sua conta, todos os seus dados serão permanentemente removidos de
                    nossos sistemas, incluindo:
                  </p>
                  <ul className="list-disc list-inside text-sm space-y-1 ml-2 text-muted-foreground">
                    <li>Informações pessoais (nome, e-mail, telefone)</li>
                    <li>Perfil de investidor e histórico de respostas</li>
                    <li>Favoritos e preferências</li>
                    <li>Histórico de visualizações</li>
                    <li>Assinatura ativa (será cancelada automaticamente)</li>
                  </ul>
                  <p className="text-sm font-semibold text-destructive mt-4">
                    ⚠️ Esta ação é irreversível e está em conformidade com a LGPD (Lei Geral de
                    Proteção de Dados).
                  </p>
                </div>

                <div className="pt-4">
                  <DeleteAccountDialog />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <InvestorProfileModal
          open={showModal}
          onOpenChange={setShowModal}
          onComplete={handleCompleteOnboarding}
        />

        <ContactSpecialistDialog 
          open={showContactDialog} 
          onOpenChange={setShowContactDialog}
          planName="SPECIALIST"
        />
      </div>
    </AppLayout>
  );
};

export default Perfil;
