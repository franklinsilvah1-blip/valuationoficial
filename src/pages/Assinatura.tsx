import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PlanCard from "@/components/PlanCard";
import ContactSpecialistDialog from "@/components/ContactSpecialistDialog";
import SEOHead, { createFAQSchema, createBreadcrumbSchema, createProductSchema, createFinancialServiceSchema, createSpeakableSchema } from "@/components/SEOHead";
import { Shield, HelpCircle } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useNavigate } from "react-router-dom";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { SELECTABLE_PLANS, getPlanInfo, type BillingCycle, type PlanType } from "@/utils/planHelpers";
import { getStoredAffiliateCode } from "@/hooks/useAffiliateTracking";
import { useSubscriptionPlans } from "@/hooks/useSubscriptionPlans";
import { getPlanByCode } from "@/hooks/useSubscriptionPlans";

const formatMoney = (value: number) =>
  `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface DisplayPlan {
  code: PlanType;
  name: string;
  description: string;
  price: string;
  period: string;
  billingNote?: string;
  features: string[];
  highlighted: boolean;
  consultOnly: boolean;
  isFree: boolean;
}

const Assinatura = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [showContactDialog, setShowContactDialog] = useState(false);
  const [cycle, setCycle] = useState<BillingCycle>("quarterly");

  const { data: dbPlans } = useSubscriptionPlans();

  // Os 4 planos comerciais atuais, nesta ordem. Preço/texto vêm de
  // subscription_plans quando disponível (fonte de verdade editável pelo
  // admin), com fallback para o texto estático de planHelpers.ts caso a
  // tabela ainda não tenha sido migrada/populada no ambiente.
  const plans: DisplayPlan[] = useMemo(() => {
    return SELECTABLE_PLANS.map((code) => {
      const staticInfo = getPlanInfo(code);
      const dbPlan = getPlanByCode(dbPlans, code);

      const isFree = dbPlan ? (dbPlan.price_monthly ?? 0) === 0 && !dbPlan.is_contact_only : staticInfo.isFree;
      const isContactOnly = dbPlan ? dbPlan.is_contact_only : staticInfo.isContactOnly;

      let price: string;
      let period: string;
      if (isFree) {
        price = "Grátis";
        period = "";
      } else if (isContactOnly) {
        price = "Sob consulta";
        period = "";
      } else {
        const amount =
          cycle === "monthly"
            ? dbPlan?.price_monthly ?? staticInfo.priceMonthly
            : dbPlan?.price_quarterly ?? staticInfo.priceQuarterly;
        price = amount != null ? formatMoney(amount) : "—";
        period = cycle === "monthly" ? "mês" : "trimestre";
      }

      return {
        code,
        name: dbPlan?.display_name || staticInfo.displayName,
        description: dbPlan?.description || staticInfo.description,
        price,
        period,
        billingNote: !isFree && !isContactOnly ? undefined : dbPlan?.price_note || staticInfo.priceNote,
        features: dbPlan?.features?.length ? dbPlan.features : staticInfo.features,
        highlighted: code === "PRO",
        consultOnly: isContactOnly,
        isFree,
      };
    });
  }, [dbPlans, cycle]);

  const handleSubscribe = async (planCode: PlanType) => {
    if (!user) {
      navigate(`/auth?plan=${planCode}&mode=signup`);
      return;
    }
    if (planCode === "START") {
      navigate("/app/dashboard");
      return;
    }
    if (planCode === "WEALTH") {
      setShowContactDialog(true);
      return;
    }
    setLoadingPlan(planCode);
    try {
      if (typeof window !== "undefined" && (window as any).fbq) {
        const staticInfo = getPlanInfo(planCode);
        (window as any).fbq("track", "InitiateCheckout", {
          content_name: planCode,
          content_category: "Subscription",
          value: cycle === "monthly" ? staticInfo.priceMonthly : staticInfo.priceQuarterly,
          currency: "BRL",
        });
      }

      const affiliateCode = getStoredAffiliateCode();

      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: {
          plan: planCode,
          cycle,
          affiliateCode: affiliateCode || undefined,
        },
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
        variant: "destructive",
      });
    } finally {
      setLoadingPlan(null);
    }
  };

  const faqs = [
    {
      question: "Como funciona a cobrança dos planos PRO e SPECIALIST?",
      answer:
        "Os planos PRO e SPECIALIST podem ser assinados mensalmente ou trimestralmente — escolha o ciclo que preferir na página de planos. START é sempre gratuito e WEALTH é sob consulta comercial.",
    },
    {
      question: "Posso mudar de plano depois?",
      answer: "Sim! Você pode fazer upgrade ou downgrade do seu plano a qualquer momento. As mudanças entram em vigor no próximo ciclo de cobrança.",
    },
    {
      question: "Como funcionam os planos SPECIALIST e WEALTH?",
      answer:
        "O SPECIALIST inclui todos os benefícios do PRO, com acesso a especialista e carteira personalizada. O WEALTH é sob consulta, com cobrança comercial baseada em percentual sobre o valor investido, voltado a investidores com maior capacidade de investimento.",
    },
    {
      question: "Quais formas de pagamento são aceitas?",
      answer: "Aceitamos cartão de crédito (Visa, Mastercard, Amex, Elo) e PIX.",
    },
    {
      question: "Posso cancelar minha assinatura?",
      answer: "Sim, você pode cancelar sua assinatura a qualquer momento. Você continuará tendo acesso até o fim do período já pago.",
    },
  ];

  const faqSchema = createFAQSchema(faqs);
  const breadcrumbSchema = createBreadcrumbSchema([
    { name: "Home", url: "https://valuationit.com.br/" },
    { name: "Planos e Preços", url: "https://valuationit.com.br/assinatura" },
  ]);

  const productSchemas = [
    createProductSchema("PRO", "Acesso completo aos dados e indicadores de todos os ativos", 29.9),
    createProductSchema("SPECIALIST", "Todos os benefícios do PRO, com acesso a especialista e carteira personalizada", 249.9),
  ];

  const financialServiceSchema = createFinancialServiceSchema(
    "Consultoria de Investimentos VALUATION",
    "Análises profissionais de ações, FIIs, BDRs e criptomoedas com carteiras personalizadas e suporte especializado",
    [
      { price: 29.9, priceCurrency: "BRL" },
      { price: 249.9, priceCurrency: "BRL" },
    ]
  );

  const speakableSchema = createSpeakableSchema("https://valuationit.com.br/assinatura", [
    "[data-speakable='assinatura-title']",
    "[data-speakable='assinatura-description']",
    "[data-speakable='garantia-title']",
    "[data-speakable='faq-title']",
  ]);

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Planos e Preços - Assinatura de Consultoria de Investimentos"
        description="Escolha o plano ideal para seu perfil de investidor: START, PRO, SPECIALIST ou WEALTH."
        canonical="https://valuationit.com.br/assinatura"
        keywords={["planos de investimento", "assinatura", "consultoria financeira", "carteira recomendada", "análise de ativos"]}
        jsonLd={[faqSchema, breadcrumbSchema, ...productSchemas, financialServiceSchema, speakableSchema]}
      />
      <Navbar />
      <ContactSpecialistDialog open={showContactDialog} onOpenChange={setShowContactDialog} planName="WEALTH" />

      {/* Hero */}
      <section className="gradient-hero py-16">
        <div className="container text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-primary-foreground mb-4" data-speakable="assinatura-title">
            Escolha o plano ideal para o seu perfil
          </h1>
          <p className="text-lg text-primary-foreground/90 max-w-2xl mx-auto" data-speakable="assinatura-description">
            Análises profissionais e personalizadas de investimentos.
          </p>
        </div>
      </section>

      {/* Plans */}
      <section className="py-20">
        <div className="container">
          {/* Seletor de ciclo — afeta apenas PRO e SPECIALIST */}
          <div className="flex justify-center mb-10">
            <div className="inline-flex rounded-lg border border-border bg-muted p-1">
              <button
                type="button"
                onClick={() => setCycle("monthly")}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  cycle === "monthly" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
                }`}
              >
                Mensal
              </button>
              <button
                type="button"
                onClick={() => setCycle("quarterly")}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  cycle === "quarterly" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
                }`}
              >
                Trimestral
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {plans.map((plan) => (
              <PlanCard
                key={plan.code}
                name={plan.name}
                description={plan.description}
                price={plan.price}
                period={plan.period}
                billingNote={plan.billingNote}
                features={plan.features}
                highlighted={plan.highlighted}
                consultOnly={plan.consultOnly}
                ctaLabel={getPlanInfo(plan.code).ctaLabel}
                onSubscribe={() => handleSubscribe(plan.code)}
                loading={loadingPlan === plan.code}
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
            <h2 className="text-2xl font-bold mb-4" data-speakable="garantia-title">
              Garantia de 7 Dias
            </h2>
            <p className="text-muted-foreground">
              Teste nossa plataforma sem riscos. Se não estiver satisfeito nos primeiros 7 dias, devolvemos 100% do seu
              dinheiro.
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
            <h2 className="text-3xl font-bold" data-speakable="faq-title">
              Perguntas Frequentes
            </h2>
          </div>

          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger className="text-left">{faq.question}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      <Footer />
    </div>
  );
};
export default Assinatura;
