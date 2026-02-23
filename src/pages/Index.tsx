import { useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SearchFilters from "@/components/SearchFilters";
import Testimonials from "@/components/Testimonials";
import HomeBlogSection from "@/components/HomeBlogSection";
import SEOHead, { 
  createOrganizationSchema, 
  createWebSiteSchema,
  createLocalBusinessSchema,
  createAggregateRatingSchema,
  createSoftwareApplicationSchema,
  createSpeakableSchema
} from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, BarChart3, Users, TrendingUp } from "lucide-react";
import heroBackground from "@/assets/hero-background.webp";

const Index = () => {
  const [searchFilters, setSearchFilters] = useState({});
  
  const handleSearch = (filters: any) => {
    setSearchFilters(filters);
    // Navigate to mercado with filters
    if (Object.keys(filters).length > 0) {
      window.location.href = `/mercado?${new URLSearchParams(filters).toString()}`;
    }
  };
  
  const benefits = [{
    icon: <BarChart3 className="h-8 w-8 text-primary" />,
    title: "Análises profissionais",
    description: "Recomendações atualizadas de especialistas referências em ativos globais."
  }, {
    icon: <Shield className="h-8 w-8 text-primary" />,
    title: "Carteiras personalizadas",
    description: "Acesso a carteiras recomendadas segmentadas por perfil de investidor."
  }, {
    icon: <Users className="h-8 w-8 text-primary" />,
    title: "Conteúdos exclusivos",
    description: "Conhecimento estratégico e exclusivo sobre investimentos."
  }, {
    icon: <TrendingUp className="h-8 w-8 text-primary" />,
    title: "Acompanhamento em tempo real",
    description: "Fique por dentro das movimentações e tendências do mercado."
  }];

  // JSON-LD structured data for homepage
  const jsonLdSchemas = [
    createOrganizationSchema(),
    createWebSiteSchema(),
    createLocalBusinessSchema(),
    createAggregateRatingSchema(4.9, 5000, 5),
    createSoftwareApplicationSchema(),
    createSpeakableSchema("https://valuationit.com.br/", [
      "[data-speakable='hero-title']",
      "[data-speakable='hero-description']",
      "[data-speakable='benefits-title']",
      "[data-speakable='cta-title']",
    ]),
  ];

  return (
    <div className="min-h-screen">
      <SEOHead
        title="VALUATION Invest Tech - Consultoria de Investimentos Inteligente"
        description="Análises profissionais de ações, FIIs, BDRs, ETFs e Criptomoedas da B3. Recomendações de especialistas para todos os perfis de investidor. Carteiras personalizadas e conteúdos exclusivos."
        canonical="https://valuationit.com.br/"
        ogImage="https://valuationit.com.br/og-image.png"
        keywords={[
          "consultoria de investimentos",
          "análise de ações",
          "FIIs",
          "fundos imobiliários",
          "BDRs",
          "investimentos B3",
          "carteira de investimentos",
          "recomendações de ativos",
          "análise fundamentalista",
          "valuation"
        ]}
        jsonLd={jsonLdSchemas}
      />
      
      <Navbar />

      {/* Hero Section */}
      <section className="relative py-12 md:py-20 lg:py-32 overflow-hidden">
        {/* Background Image */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat" 
          style={{ backgroundImage: `url(${heroBackground})` }}
          aria-hidden="true"
        ></div>
        
        {/* Overlay 75% */}
        <div className="absolute inset-0 bg-black/75" aria-hidden="true"></div>
        
        <div className="container relative z-10">
          <div className="max-w-[800px] mx-auto text-center animate-fade-in">
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold text-primary-foreground mb-6" data-speakable="hero-title">
              <span className="block">Consultoria de Investimentos</span>
              <span className="block text-[hsl(45,100%,51%)]">Inteligente e personalizada</span>
            </h1>
            <p className="text-lg md:text-xl text-primary-foreground/90 mb-8" data-speakable="hero-description">
              Acesse análises completas de ações, FIIs, BDRs, ETFs e Criptomoedas. Recomendações de especialistas para todos os tipos de perfis de investidor.
            </p>

            {/* Free Search */}
            <div className="bg-background/95 backdrop-blur p-4 sm:p-6 rounded-2xl shadow-elevated animate-slide-up">
              <h2 className="text-xl font-semibold mb-4 text-foreground">Busca Gratuita</h2>
              <SearchFilters onSearch={handleSearch} />
              <p className="text-xs text-muted-foreground mt-3">
                Busque informações básicas gratuitamente. Assine para análises completas.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-12 md:py-20 bg-muted/30">
        <div className="container">
          <div className="text-center mb-8 md:mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4" data-speakable="benefits-title">Por Que Assinar?</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Tenha acesso a ferramentas profissionais e análises detalhadas para tomar decisões de investimento mais assertivas e eficientes.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {benefits.map((benefit, index) => (
              <article 
                key={index} 
                className="bg-card p-4 sm:p-6 rounded-xl shadow-card hover:shadow-elevated transition-all duration-300 animate-slide-up" 
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="mb-4" aria-hidden="true">{benefit.icon}</div>
                <h3 className="text-lg font-semibold mb-2">{benefit.title}</h3>
                <p className="text-sm text-muted-foreground">{benefit.description}</p>
              </article>
            ))}
          </div>

          <div className="text-center mt-8 md:mt-12">
            <Link to="/assinatura">
              <Button size="lg" className="gradient-cta text-accent-foreground font-semibold hover:opacity-90">
                Ver Planos e Preços
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Blog Section */}
      <HomeBlogSection />

      {/* Testimonials Section */}
      <Testimonials />

      {/* CTA Section */}
      <section className="py-12 md:py-20 gradient-hero">
        <div className="container text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground mb-4" data-speakable="cta-title">
            Pronto para Investir Melhor?
          </h2>
          <p className="text-lg text-primary-foreground/90 mb-8 max-w-2xl mx-auto">
            Junte-se a milhares de investidores que já utilizam nossas análises para tomar decisões mais inteligentes
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/assinatura">
              <Button size="lg" className="bg-background text-foreground hover:bg-background/90 font-semibold">
                Assinar Agora
              </Button>
            </Link>
            <Link to="/mercado">
              <Button size="lg" variant="outline" className="border-primary-foreground text-slate-950 bg-gray-200 hover:bg-gray-100">
                Explorar Mercado
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Index;
