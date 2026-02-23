import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PlanCard from "@/components/PlanCard";
import ContactSpecialistDialog from "@/components/ContactSpecialistDialog";
import SEOHead, { createFAQSchema, createBreadcrumbSchema, createProductSchema, createFinancialServiceSchema, createSpeakableSchema } from "@/components/SEOHead";
import { Shield, HelpCircle, Check } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { getPlanDisplayNameSimple } from "@/utils/planHelpers";
import { getStoredAffiliateCode } from "@/hooks/useAffiliateTracking";
import { useSubscriptionPlans, formatPlanPrice } from "@/hooks/useSubscriptionPlans";

const Assinatura = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, subscriptionData } = useAuth();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [showContactDialog, setShowContactDialog] = useState(false);
  
  const { data: dbPlans, isLoading: loadingPlans } = useSubscriptionPlans();
  
  // Mostrar plano de teste apenas para usuários específicos
  const TEST_USERS = ["contato@dradigital.com.br", "franklinsilvah1@gmail.com"];
  const isTestUser = user?.email && TEST_USERS.includes(user.email);

  const plans = useMemo(() => {
    if (!dbPlans || dbPlans.length === 0) {
      // Fallback para dados hardcoded
      return [
        {
          name: "FREE",
          description: "",
          price: "Experimente grátis!",
          period: "",
          features: ["Visualização de até 3 ativos por dia", "Acesso básico ao Mercado", "Análises resumidas de ativos", "Análise de perfil investidor"],
          highlighted: false
        },
        {
          name: "START",
          description: "Para investidores iniciantes",
          price: "R$ 49",
          period: "mês",
          billingNote: "Cobrado trimestralmente (R$ 147,00 a cada 3 meses)",
          features: ["Acesso completo a plataforma", "Análises detalhadas de ativos", "Carteiras recomendadas START", "Acesso à Conteúdos exclusivos", "Suporte por email"],
          highlighted: false
        },
        {
          name: "PRO",
          description: "Para investidores intermediários",
          price: "R$ 99",
          period: "mês",
          billingNote: "Cobrado trimestralmente (R$ 297,00 a cada 3 meses)",
          features: ["Todos os benefícios do START", "Análises avançadas de ativos", "Carteiras recomendadas PRO", "Suporte por chat", "Consultoria com Especialista"],
          highlighted: true
        },
        {
          name: "SPECIALIST",
          description: "Para investidores Profissionais",
          price: "R$ 199",
          period: "mês",
          billingNote: "Cobrado trimestralmente (R$ 597,00 a cada 3 meses)",
          features: ["Todos os benefícios do PRO", "Análises personalizadas de ativos", "Carteiras recomendadas SPECIALIST", "Suporte prioritário", "Método X Valuation", "Mentoria THE SPECIALISTS"],
          highlighted: false
        },
        {
          name: "WEALTH",
          description: "Para investidores e empresários",
          price: "Consulte",
          period: "",
          features: ["Todos os benefícios do SPECIALIST", "Estratégia personalizada", "Ampliação inteligente de patrimônio", "Blindagem estratégica da riqueza", "Mentoria exclusiva para investidores e empresas"],
          highlighted: false,
          consultOnly: true
        }
      ];
    }

    const mappedPlans = dbPlans.map(plan => ({
      name: plan.plan_code,
      description: plan.description || "",
      price: plan.plan_code === "FREE" ? "Experimente grátis!" : 
             plan.plan_code === "WEALTH" ? "Consulte" : 
             formatPlanPrice(plan.price_quarterly),
      period: plan.plan_code !== "FREE" && plan.plan_code !== "WEALTH" ? "mês" : "",
      billingNote: plan.price_note || undefined,
      features: plan.features || [],
      highlighted: plan.plan_code === "PRO",
      consultOnly: plan.plan_code === "WEALTH",
      isTestPlan: false,
    }));

    // Adicionar plano de teste apenas para usuário específico
    if (isTestUser) {
      mappedPlans.push({
        name: "TESTE",
        description: "Plano de teste - apenas para desenvolvimento",
        price: "R$ 2",
        period: "dia",
        billingNote: "Cobrança diária para testes",
        features: ["Acesso de teste", "Cobrança diária de R$ 2,00", "Apenas para validação"],
        highlighted: false,
        consultOnly: false,
        isTestPlan: true,
      });
    }

    return mappedPlans;
  }, [dbPlans, isTestUser]);

  const handleSubscribe = async (planName: string) => {
    if (!user) {
      navigate(`/auth?plan=${planName}&mode=signup`);
      return;
    }
    if (planName === "FREE") {
      navigate("/app/dashboard");
      return;
    }
    if (planName === "WEALTH") {
      setShowContactDialog(true);
      return;
    }
    setLoadingPlan(planName);
    try {
      // Track InitiateCheckout event
      if (typeof window !== 'undefined' && (window as any).fbq) {
        (window as any).fbq('track', 'InitiateCheckout', {
          content_name: planName,
          content_category: 'Subscription',
          value: planName === 'START' ? 49 : planName === 'PRO' ? 99 : 0,
          currency: 'BRL'
        });
        console.log('✅ Facebook Pixel: InitiateCheckout tracked for', planName);
      }

      // Get affiliate code from localStorage if available
      const affiliateCode = getStoredAffiliateCode();
      
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: {
          plan: planName,
          affiliateCode: affiliateCode || undefined
        }
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error: any) {
      console.error("Erro ao criar checkout:", error);
      toast({
        title: "Erro ao processar",
        description: error.message || "Não foi possível iniciar o processo de assinatura. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setLoadingPlan(null);
    }
  };
  const faqs = [{
    question: "Como funciona a cobrança trimestral?",
    answer: "Os planos START, PRO e SPECIALIST são cobrados a cada 3 meses (trimestralmente). A cobrança trimestral facilita o planejamento financeiro e oferece praticidade."
  }, {
    question: "Como funciona o período de teste?",
    answer: "Oferecemos 7 dias de teste gratuito para novos assinantes. Você pode cancelar a qualquer momento sem custos."
  }, {
    question: "Posso mudar de plano depois?",
    answer: "Sim! Você pode fazer upgrade ou downgrade do seu plano a qualquer momento. As mudanças entram em vigor no próximo ciclo de cobrança."
  }, {
    question: "Como funciona o plano SPECIALIST e WEALTH?",
    answer: "Os planos SPECIALIST e WEALTH são personalizados de acordo com suas necessidades. O SPECIALIST foca em estratégias de médio prazo com multiplicação de capital, enquanto o WEALTH oferece mentoria exclusiva para investidores e empresários."
  }, {
    question: "Quais formas de pagamento são aceitas?",
    answer: "Aceitamos cartão de crédito (Visa, Mastercard, Amex, Elo) e PIX. As cobranças são trimestrais e recorrentes."
  }, {
    question: "Posso cancelar minha assinatura?",
    answer: "Sim, você pode cancelar sua assinatura a qualquer momento. Você continuará tendo acesso até o fim do período já pago."
  }];

  const faqSchema = createFAQSchema(faqs);
  const breadcrumbSchema = createBreadcrumbSchema([
    { name: "Home", url: "https://valuationit.com.br/" },
    { name: "Planos e Preços", url: "https://valuationit.com.br/assinatura" },
  ]);

  // Product schemas for each paid plan
  const productSchemas = [
    createProductSchema("START", "Para investidores iniciantes - Análises detalhadas de ativos, carteiras recomendadas START e suporte por email", 49),
    createProductSchema("PRO", "Para investidores intermediários - Análises avançadas, carteiras PRO, suporte por chat e consultoria com especialista", 99),
    createProductSchema("SPECIALIST", "Para investidores profissionais - Análises personalizadas, método X Valuation e mentoria THE SPECIALISTS", 199),
  ];

  // Financial service schema
  const financialServiceSchema = createFinancialServiceSchema(
    "Consultoria de Investimentos VALUATION",
    "Análises profissionais de ações, FIIs, BDRs e criptomoedas com carteiras personalizadas e suporte especializado",
    [
      { price: 49, priceCurrency: "BRL" },
      { price: 99, priceCurrency: "BRL" },
      { price: 199, priceCurrency: "BRL" },
    ]
  );

  // Speakable schema for voice search
  const speakableSchema = createSpeakableSchema("https://valuationit.com.br/assinatura", [
    "[data-speakable='assinatura-title']",
    "[data-speakable='assinatura-description']",
    "[data-speakable='garantia-title']",
    "[data-speakable='faq-title']",
  ]);

  return <div className="min-h-screen bg-background">
      <SEOHead
        title="Planos e Preços - Assinatura de Consultoria de Investimentos"
        description="Escolha o plano ideal para seu perfil de investidor. Planos START, PRO e SPECIALIST com análises profissionais, carteiras recomendadas e suporte especializado. Garantia de 7 dias."
        canonical="https://valuationit.com.br/assinatura"
        keywords={["planos de investimento", "assinatura", "consultoria financeira", "carteira recomendada", "análise de ativos"]}
        jsonLd={[faqSchema, breadcrumbSchema, ...productSchemas, financialServiceSchema, speakableSchema]}
      />
      <Navbar />
      <ContactSpecialistDialog open={showContactDialog} onOpenChange={setShowContactDialog} planName="SPECIALIST" />

      {/* Hero */}
      <section className="gradient-hero py-16">
        <div className="container text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-primary-foreground mb-4" data-speakable="assinatura-title">Escolha o plano ideal para o seu perfil</h1>
          <p className="text-lg text-primary-foreground/90 max-w-2xl mx-auto" data-speakable="assinatura-description">Análises profissionais e personalizadas de investimentos.</p>
        </div>
      </section>

      {/* Plans */}
      <section className="py-20">
        <div className="container">
          {/* Plano FREE - Card padronizado como os demais */}
          <div className="bg-card border border-border rounded-xl p-8 mb-12 max-w-5xl mx-auto shadow-card">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
              {/* Coluna 1: Título - centralizado em mobile, esquerda em desktop */}
              <div className="text-center md:text-left">
                <h3 className="text-2xl font-bold text-foreground">FREE</h3>
                <p className="text-3xl font-bold text-primary mt-2">Experimente grátis!</p>
              </div>

              {/* Coluna 2: Features - alinhado à esquerda */}
              <div className="text-left">
                <ul className="space-y-2">
                  {plans[0].features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-secondary shrink-0 mt-0.5" />
                      <span className="text-sm text-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Coluna 3: CTA - centralizado */}
              <div className="text-center md:text-right flex flex-col items-center md:items-end justify-center">
                <p className="text-sm text-muted-foreground mb-4">
                  Comece agora sem compromisso
                </p>
                <Button
                  onClick={() => handleSubscribe("FREE")}
                  size="lg"
                  className="px-8"
                >
                  {loadingPlan === "FREE" ? "Carregando..." : "Começar Grátis"}
                </Button>
              </div>
            </div>
          </div>

          {/* Planos Pagos - Grid de 4 colunas */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {plans.slice(1).map((plan, index) => (
              <PlanCard
                key={index}
                name={getPlanDisplayNameSimple(plan.name)}
                description={plan.description}
                price={plan.price}
                period={plan.period}
                billingNote={plan.billingNote}
                features={plan.features}
                highlighted={plan.highlighted}
                consultOnly={plan.consultOnly}
                onSubscribe={() => handleSubscribe(plan.name)}
                loading={loadingPlan === plan.name}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Guarantee */}
      <section className="py-16 bg-muted/30">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-secondary/10 mb-4">
              <Shield className="h-8 w-8 text-secondary" />
            </div>
            <h2 className="text-2xl font-bold mb-4" data-speakable="garantia-title">Garantia de 7 Dias</h2>
            <p className="text-muted-foreground">
              Teste nossa plataforma sem riscos. Se não estiver satisfeito nos primeiros 7 dias, devolvemos 100% do
              seu dinheiro.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20">
        <div className="container max-w-3xl">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <HelpCircle className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-3xl font-bold" data-speakable="faq-title">Perguntas Frequentes</h2>
          </div>

          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger className="text-left">{faq.question}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{faq.answer}</AccordionContent>
              </AccordionItem>)}
          </Accordion>
        </div>
      </section>
      
      <Footer />
    </div>;
};
export default Assinatura;