import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Breadcrumbs from "@/components/Breadcrumbs";
import SEOHead, { createServiceSchema, createPersonSchema, createBreadcrumbSchema, createHowToSchema, createSpeakableSchema } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, Phone, Calendar, Users, TrendingUp, Building2, Award } from "lucide-react";
import { useNavigate } from "react-router-dom";
import franklinPhoto from "@/assets/franklin-silvah.webp";
import OptimizedImage from "@/components/OptimizedImage";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import InputMask from "react-input-mask";
import { useState } from "react";
import TurnstileWidget from "@/components/TurnstileWidget";

const formSchema = z.object({
  name: z.string().trim().min(2, {
    message: "Nome deve ter pelo menos 2 caracteres"
  }).max(100, {
    message: "Nome deve ter no máximo 100 caracteres"
  }),
  email: z.string().trim().email({
    message: "Email inválido"
  }).max(255, {
    message: "Email deve ter no máximo 255 caracteres"
  }),
  phone: z.string().trim().min(10, {
    message: "Telefone inválido"
  }).max(20, {
    message: "Telefone deve ter no máximo 20 caracteres"
  }),
  subject: z.string().trim().min(3, {
    message: "Assunto deve ter pelo menos 3 caracteres"
  }).max(200, {
    message: "Assunto deve ter no máximo 200 caracteres"
  }),
  message: z.string().trim().min(10, {
    message: "Mensagem deve ter pelo menos 10 caracteres"
  }).max(1000, {
    message: "Mensagem deve ter no máximo 1000 caracteres"
  })
});
const Consultoria = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [turnstileToken, setTurnstileToken] = useState<string>("");

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      subject: "",
      message: ""
    }
  });

  const handleTurnstileVerify = (token: string) => {
    setTurnstileToken(token);
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!turnstileToken) {
      toast({
        title: "Verificação necessária",
        description: "Por favor, complete a verificação de segurança.",
        variant: "destructive",
      });
      return;
    }

    try {
      toast({
        title: "Enviando...",
        description: "Aguarde enquanto processamos sua solicitação."
      });
      const { supabase } = await import("@/integrations/supabase/client");
      const { error } = await supabase.functions.invoke("send-contact-email", {
        body: {
          ...values,
          turnstileToken,
        }
      });
      if (error) {
        throw error;
      }
      form.reset();
      setTurnstileToken("");

      toast({
        title: "Mensagem enviada!",
        description: "Entraremos em contato em breve."
      });
    } catch (error: any) {
      console.error("Error sending contact form:", error);
      toast({
        title: "Erro ao enviar",
        description: error.message || "Por favor, tente novamente.",
        variant: "destructive"
      });
    }
  };
  const services = [{
    icon: <Users className="h-10 w-10 text-primary" />,
    title: "Valuation START",
    description: <>Sair da inércia e entrar no mercado financeiro não precisa ser complexo. A <strong>Valuation START</strong> é uma consultoria desenhada especificamente para quem deseja construir seu primeiro portfólio de ativos com clareza e segurança. Transformamos o "financês" em estratégia prática, guiando você na criação de uma carteira personalizada e assertiva, protegendo seu capital enquanto você aprende a investir como um especialista.</>,
    buttonText: "Assinar",
    buttonAction: "purchase",
    badge: "Iniciante",
    badgeVariant: "default" as const
  }, {
    icon: <TrendingUp className="h-10 w-10 text-primary" />,
    title: "Valuation PRO",
    description: <>Amplie seus horizontes com o suporte de um especialista. A consultoria <strong>Valuation PRO</strong> foca na diversificação inteligente e na análise profunda de ativos para quem busca ir além do básico. Segurança, técnica e visão estratégica para consolidar sua maturidade no mercado financeiro.</>,
    buttonText: "Assinar",
    buttonAction: "purchase",
    badge: "Mais Popular",
    badgeVariant: "secondary" as const
  }, {
    icon: <Award className="h-10 w-10 text-primary" />,
    title: "Valuation SPECIALIST",
    description: "Domine estratégias de médio prazo com foco em multiplicação de capital. Uma mentoria desenhada para quem já conhece o jogo e busca o próximo nível: a união entre a teoria de Markowitz e a execução tática de swing trade avançado. Potencialize seus ganhos trimestrais e transforme sua técnica em resultados extraordinários acima do mercado.",
    buttonText: "Assinar",
    buttonAction: "purchase",
    badge: "Premium",
    badgeVariant: "default" as const
  }, {
    icon: <Building2 className="h-10 w-10 text-primary" />,
    title: "Valuation WEALTH",
    description: <>Mentoria exclusiva desenhada para investidores e empresários que não abrem mão de uma estratégia técnica e personalizada. No <strong>Valuation WEALTH</strong>, focamos na valorização real de ativos, ampliação inteligente de patrimônio e blindagem estratégica da riqueza. Transforme sua visão financeira e alcance um novo patamar de prosperidade com quem domina a ciência do valuation aplicada ao crescimento real.</>,
    buttonText: "Agendar Reunião",
    buttonAction: "schedule",
    badge: "Corporativo",
    badgeVariant: "outline" as const
  }];

  const breadcrumbItems = [
    { name: "Home", href: "/" },
    { name: "Consultoria" },
  ];

  const jsonLdSchemas = [
    createBreadcrumbSchema([
      { name: "Home", url: "https://valuationit.com.br/" },
      { name: "Consultoria", url: "https://valuationit.com.br/consultoria" },
    ]),
    createServiceSchema(
      "Consultoria de Investimentos VALUATION",
      "A 1ª consultoria Invest Tech que transforma você em um especialista no mercado financeiro!"
    ),
    createPersonSchema(
      "Franklin Silvah",
      "Fundador e Líder Executivo",
      "Administrador de Empresas, MBA em Gestão de Negócios, Especialista em Investimentos",
      franklinPhoto
    ),
    createHowToSchema(
      "Como Funciona a Metodologia VALUATION",
      "Nossa metodologia de consultoria de investimentos em 3 passos para transformar você em um especialista no mercado financeiro.",
      [
        {
          name: "Mineração de ativos globais",
          text: "Realizamos análise de relevância e identificamos oportunidades em ativos globais utilizando tecnologia proprietária e algoritmos inteligentes.",
        },
        {
          name: "Análise avançada e ranqueamento inteligente",
          text: "Aplicamos análise avançada com algoritmos DHI e Inteligência Artificial para ranquear e selecionar os melhores ativos.",
        },
        {
          name: "Recomendações exclusivas",
          text: "Disponibilizamos aos clientes os melhores e mais rentáveis ativos globais, atualizados constantemente com conteúdos exclusivos.",
        },
      ]
    ),
    createSpeakableSchema("https://valuationit.com.br/consultoria", [
      "[data-speakable='consultoria-title']",
      "[data-speakable='consultoria-description']",
      "[data-speakable='methodology-title']",
    ]),
  ];

  return <div className="min-h-screen bg-background">
      <SEOHead
        title="Consultoria de Investimentos - Valuation START, PRO, SPECIALIST e WEALTH"
        description="Consultoria de investimentos personalizada. Da primeira carteira à gestão de patrimônio milionário. Mentoria com especialistas para todos os perfis de investidor."
        canonical="https://valuationit.com.br/consultoria"
        keywords={["consultoria de investimentos", "mentoria financeira", "gestão de patrimônio", "investidor iniciante", "valuation"]}
        jsonLd={jsonLdSchemas}
      />
      <Navbar />

      {/* Breadcrumbs */}
      <div className="container pt-8">
        <Breadcrumbs items={breadcrumbItems} className="mb-4" />
      </div>

      {/* Hero */}
      <section className="gradient-hero py-20">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-primary-foreground mb-6" data-speakable="consultoria-title">Consultoria de Investimentos</h1>
            <p className="text-lg text-primary-foreground/90 mb-8" data-speakable="consultoria-description">A 1ª consultoria Invest Tech que transforma você em um especialista no mercado financeiro!</p>
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="py-20">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Nossos Serviços</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Inteligência financeira e gestão estratégica de ativos: Desenhadas para guiar desde o investidor iniciante até grandes corporações e especialistas.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {services.map((service, index) => <Card key={index} className="shadow-card hover:shadow-elevated transition-all duration-300 relative">
                <CardContent className="p-6">
                  {service.badge && <Badge variant={service.badgeVariant} className="absolute top-4 right-4">
                      {service.badge}
                    </Badge>}
                  <div className="mb-4">{service.icon}</div>
                  <h3 className="text-xl font-bold mb-2">{service.title}</h3>
                  <p className="text-muted-foreground mb-4">{service.description}</p>
                  <Button className="w-full gradient-cta text-accent-foreground font-semibold hover:opacity-90" size="lg" onClick={() => service.buttonAction === "purchase" ? navigate("/assinatura") : null}>
                    {service.buttonText}
                  </Button>
                </CardContent>
              </Card>)}
          </div>
        </div>
      </section>

      {/* Methodology */}
      <section className="py-20 bg-muted/30">
        <div className="container">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4" data-speakable="methodology-title">Nossa Metodologia</h2>
              <p className="text-lg text-muted-foreground">
                Tecnologia proprietária, algoritmos inteligentes e inovação constante.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[{
              step: "1",
              title: "Mineração de ativos globais",
              description: "Análise de relevância e oportunidades em ativos globais"
            }, {
              step: "2",
              title: "Análise avançada e ranqueamento inteligente",
              description: "Análise avançada e aplicação de algoritmos DHI e IA"
            }, {
              step: "3",
              title: "Recomendações exclusivas",
              description: "Disponibilização aos clientes dos melhores e mais rentáveis ativos globais, atualizados e com conteúdos exclusivos"
            }].map((item, index) => <div key={index} className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full gradient-hero text-primary-foreground font-bold text-2xl mb-4">
                    {item.step}
                  </div>
                  <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                  <p className="text-muted-foreground">{item.description}</p>
                </div>)}
            </div>
          </div>
        </div>
      </section>

      {/* Founder */}
      <section className="py-20">
        <div className="container">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Fundador</h2>
            </div>

            <Card className="shadow-elevated">
              <CardContent className="p-8 md:p-12">
                <div className="flex flex-col md:flex-row gap-8 items-center md:items-start">
                  <div className="flex-shrink-0">
                    <OptimizedImage
                      src={franklinPhoto}
                      alt="Franklin Silvah - Fundador da ValuAtion Invest Tech"
                      width={192}
                      height={192}
                      className="w-48 h-48 rounded-full object-cover shadow-elevated"
                      lazy={true}
                    />
                  </div>
                  
                  <div className="flex-1 text-center md:text-left">
                    <h3 className="text-2xl font-bold mb-2">Franklin Silvah</h3>
                    <p className="text-primary font-semibold mb-4">Fundador e Líder Executivo</p>
                    
                    <p className="text-muted-foreground mb-4">
                      Franklin Silvah é Administrador de Empresas, MBA em Gestão de Negócios, Especialista em Investimentos e fundador da ValuAtion invest tech.
                    </p>
                    
                    <p className="text-muted-foreground mb-4">
                      Executivo com mais de 20 anos de carreira no mercado de tecnologia e serviços, Franklin fundou a ValuAtion com o objetivo de ajudar pessoas comuns e investidores a tomarem melhores decisões, com segurança e assertividade, e assim, construírem riqueza e independência financeira.
                    </p>
                    
                    <p className="text-muted-foreground mb-6">
                      Seu principal desafio é transformar o complexo mundo dos investimentos em algo acessível e rentável para seus clientes.
                    </p>
                    
                    <blockquote className="border-l-4 border-primary pl-4 italic text-foreground mb-6">
                      "Minha missão é democratizar o acesso a investimentos de qualidade, guiando cada cliente com transparência, ética e expertise rumo à independência financeira e à realização de seus objetivos."
                    </blockquote>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="py-20 bg-muted/30">
        <div className="container">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
              {/* Left Column - Contact Info */}
              <div className="space-y-8">
                <div>
                  <h2 className="text-3xl md:text-4xl font-bold mb-4">Entre em Contato</h2>
                  <p className="text-lg text-muted-foreground mb-8">Agende uma consulta gratuita e descubra como podemos ajudar</p>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gold/10 flex items-center justify-center flex-shrink-0">
                      <Phone className="h-5 w-5 text-gold" />
                    </div>
                    <div>
                      <p className="text-muted-foreground">(31) 9.9328-7761</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gold/10 flex items-center justify-center flex-shrink-0">
                      <Mail className="h-5 w-5 text-gold" />
                    </div>
                    <div>
                      <p className="text-muted-foreground">consultoria@valuationit.com.br</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-gold/10 flex items-center justify-center flex-shrink-0">
                      <Calendar className="h-5 w-5 text-gold" />
                    </div>
                    <div>
                      <p className="text-muted-foreground">Seg-Sex: 9h às 18h</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Form */}
              <div>
                <Card className="shadow-elevated bg-card">
                  <CardContent className="p-8">
                    <div className="text-center mb-6">
                      <p className="text-muted-foreground mb-2">
                        Envie-nos uma mensagem agora mesmo pelo formulário abaixo:
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Responderemos o mais breve possível
                      </p>
                    </div>

                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField control={form.control} name="name" render={({
                          field
                        }) => <FormItem>
                                <FormControl>
                                  <Input placeholder="Seu nome" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>} />

                          <FormField control={form.control} name="phone" render={({
                          field
                        }) => <FormItem>
                                <FormControl>
                                  <InputMask mask="(99) 9.9999-9999" value={field.value} onChange={field.onChange}>
                                    {(inputProps: any) => <Input {...inputProps} placeholder="Telefone com DDD" type="tel" />}
                                  </InputMask>
                                </FormControl>
                                <FormMessage />
                              </FormItem>} />
                        </div>

                        <FormField control={form.control} name="email" render={({
                        field
                      }) => <FormItem>
                              <FormControl>
                                <Input type="email" placeholder="E-mail" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>} />

                        <FormField control={form.control} name="subject" render={({
                        field
                      }) => <FormItem>
                              <FormControl>
                                <Input placeholder="Assunto" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>} />

                        <FormField control={form.control} name="message" render={({
                        field
                      }) => <FormItem>
                              <FormControl>
                                <Textarea placeholder="Mensagem" className="min-h-[140px] resize-none" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>} />

                        {/* Cloudflare Turnstile CAPTCHA */}
                        <TurnstileWidget
                          onVerify={handleTurnstileVerify}
                          theme="light"
                        />

                        <Button type="submit" size="lg" className="w-full gradient-cta text-accent-foreground font-semibold hover:opacity-90" disabled={form.formState.isSubmitting || !turnstileToken}>
                          {form.formState.isSubmitting ? "Enviando..." : "Enviar"}
                        </Button>
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>;
};
export default Consultoria;