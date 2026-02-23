import { Card } from "@/components/ui/card";
import { TrendingUp, Target, Eye, Award } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Testimonials from "@/components/Testimonials";
import Breadcrumbs from "@/components/Breadcrumbs";
import SEOHead, { createOrganizationSchema, createBreadcrumbSchema, createPersonSchema, createSpeakableSchema } from "@/components/SEOHead";

const Sobre = () => {
  const breadcrumbItems = [
    { name: "Home", href: "/" },
    { name: "Sobre Nós" },
  ];

  const jsonLdSchemas = [
    createOrganizationSchema(),
    createBreadcrumbSchema([
      { name: "Home", url: "https://valuationit.com.br/" },
      { name: "Sobre Nós", url: "https://valuationit.com.br/sobre" },
    ]),
    createPersonSchema(
      "Franklin Silvah",
      "Fundador e Líder Executivo",
      "Administrador de Empresas, MBA em Gestão de Negócios, Especialista em Investimentos e fundador da ValuAtion invest tech. Executivo com mais de 20 anos de carreira no mercado de tecnologia e serviços.",
      "https://valuationit.com.br/assets/franklin-silvah.webp"
    ),
    createSpeakableSchema("https://valuationit.com.br/sobre", [
      "[data-speakable='sobre-title']",
      "[data-speakable='sobre-description']",
      "[data-speakable='missao']",
      "[data-speakable='visao']",
    ]),
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Sobre Nós - Conheça a VALUATION Invest Tech"
        description="Conheça a história, missão e valores da VALUATION Invest Tech. Transformamos dados em decisões inteligentes de investimento para milhares de investidores no Brasil."
        canonical="https://valuationit.com.br/sobre"
        keywords={["sobre valuation", "consultoria investimentos", "história", "missão", "valores"]}
        ogImage="https://valuationit.com.br/og-image.png"
        jsonLd={jsonLdSchemas}
      />
      <Navbar />
      
      <main className="container py-12 md:py-16 lg:py-20">
        {/* Breadcrumbs */}
        <Breadcrumbs items={breadcrumbItems} className="mb-8" />

        {/* Header Section */}
        <div className="max-w-3xl mx-auto text-center mb-16 animate-fade-in">
          <h1 className="mb-6 bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent" data-speakable="sobre-title">
            Sobre Nós
          </h1>
          <p className="text-lg text-muted-foreground" data-speakable="sobre-description">
            Transformando dados em decisões inteligentes de investimento
          </p>
        </div>

        {/* História Section */}
        <section className="max-w-4xl mx-auto mb-20 animate-slide-up">
          <Card className="p-8 md:p-12 shadow-card hover:shadow-elevated transition-all duration-300">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary-glow">
                <TrendingUp className="h-6 w-6 text-primary-foreground" />
              </div>
              <h2 className="text-3xl">Nossa História</h2>
            </div>
            <div className="space-y-4 text-muted-foreground leading-relaxed">
              <p>
                A VALUATION Invest Tech nasceu da paixão por democratizar o acesso a análises 
                financeiras profissionais de alta qualidade. Fundada por especialistas em finanças 
                e tecnologia, nossa plataforma surgiu da necessidade de tornar o mercado de capitais 
                mais acessível e transparente para todos os investidores.
              </p>
              <p>
                Com anos de experiência no mercado financeiro, identificamos que muitos investidores 
                enfrentavam dificuldades para acessar informações confiáveis e análises profundas sobre 
                ativos do mercado brasileiro. Foi assim que decidimos criar uma solução tecnológica que 
                pudesse transformar a forma como as pessoas investem.
              </p>
              <p>
                Hoje, atendemos milhares de investidores em todo o Brasil, oferecendo dados precisos, 
                análises detalhadas e ferramentas que empoderam nossos usuários a tomar decisões de 
                investimento mais inteligentes e fundamentadas.
              </p>
            </div>
          </Card>
        </section>

        {/* Missão, Visão e Valores Grid */}
        <section className="max-w-6xl mx-auto grid md:grid-cols-3 gap-6 mb-20">
          {/* Missão */}
          <Card className="p-8 shadow-card hover:shadow-elevated transition-all duration-300 hover:-translate-y-1 animate-slide-up">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-accent/10 mb-4">
                <Target className="h-8 w-8 text-accent" />
              </div>
              <h3 className="mb-4 text-foreground" data-speakable="missao">Missão</h3>
              <p className="text-muted-foreground leading-relaxed">
                Democratizar o acesso a análises financeiras profissionais, capacitando 
                investidores de todos os níveis a tomar decisões inteligentes baseadas em 
                dados confiáveis e de alta qualidade.
              </p>
            </div>
          </Card>

          {/* Visão */}
          <Card className="p-8 shadow-card hover:shadow-elevated transition-all duration-300 hover:-translate-y-1 animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <div className="flex flex-col items-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-accent/10 mb-4">
                <Eye className="h-8 w-8 text-accent" />
              </div>
              <h3 className="mb-4 text-foreground" data-speakable="visao">Visão</h3>
              <p className="text-muted-foreground leading-relaxed">
                Ser a plataforma de referência em análise de investimentos no Brasil, 
                reconhecida pela excelência em tecnologia, precisão dos dados e capacidade 
                de transformar informações em resultados reais para nossos usuários.
              </p>
            </div>
          </Card>

          {/* Valores */}
          <Card className="p-8 shadow-card hover:shadow-elevated transition-all duration-300 hover:-translate-y-1 animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <div className="flex flex-col items-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-accent/10 mb-4">
                <Award className="h-8 w-8 text-accent" />
              </div>
              <h3 className="mb-4 text-foreground">Valores</h3>
              <ul className="text-muted-foreground text-left space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-1">•</span>
                  <span><strong className="text-foreground">Transparência:</strong> Dados claros e verificáveis</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-1">•</span>
                  <span><strong className="text-foreground">Excelência:</strong> Qualidade em tudo que fazemos</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-1">•</span>
                  <span><strong className="text-foreground">Inovação:</strong> Tecnologia a serviço do investidor</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-1">•</span>
                  <span><strong className="text-foreground">Acessibilidade:</strong> Informação para todos</span>
                </li>
              </ul>
            </div>
          </Card>
        </section>

        {/* Diferenciais Section */}
        <section className="max-w-4xl mx-auto mb-20">
          <Card className="p-8 md:p-12 shadow-card bg-gradient-to-br from-card to-muted/20">
            <h2 className="text-3xl text-center mb-8">Por que escolher a VALUATION?</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <h4 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <span className="text-accent">✓</span> Dados Confiáveis
                </h4>
                <p className="text-muted-foreground">
                  Informações atualizadas e verificadas do mercado brasileiro
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <span className="text-accent">✓</span> Análises Profissionais
                </h4>
                <p className="text-muted-foreground">
                  Relatórios detalhados elaborados por especialistas
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <span className="text-accent">✓</span> Tecnologia de Ponta
                </h4>
                <p className="text-muted-foreground">
                  Plataforma moderna e intuitiva para suas análises
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <span className="text-accent">✓</span> Suporte Dedicado
                </h4>
                <p className="text-muted-foreground">
                  Equipe pronta para auxiliar em suas decisões
                </p>
              </div>
            </div>
          </Card>
        </section>
      </main>

      {/* Testimonials Section */}
      <Testimonials />
      
      <Footer />
    </div>
  );
};

export default Sobre;
