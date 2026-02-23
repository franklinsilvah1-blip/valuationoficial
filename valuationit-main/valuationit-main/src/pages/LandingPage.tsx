import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Helmet } from "react-helmet";
import { BarChart3, Wallet, BookOpen, Headphones, Play, ArrowRight, Star, Quote } from "lucide-react";
import SignupForm from "@/components/SignupForm";

const LandingPage = () => {
  const navigate = useNavigate();
  const [showVideo, setShowVideo] = useState(false);

  const benefits = [
    { icon: BarChart3, title: "Análises Profissionais", desc: "Recomendações fundamentadas para FIIs, Ações e BDRs" },
    { icon: Wallet, title: "Carteiras Recomendadas", desc: "Portfólios montados por especialistas para cada perfil" },
    { icon: BookOpen, title: "Conteúdos Exclusivos", desc: "Vídeos, relatórios e materiais educativos" },
    { icon: Headphones, title: "Suporte Especializado", desc: "Tire dúvidas com nosso time de especialistas" },
  ];

  const steps = [
    { num: "1", title: "Cadastre-se Grátis", desc: "Crie sua conta em menos de 1 minuto" },
    { num: "2", title: "Explore o Mercado", desc: "Acesse análises de centenas de ativos" },
    { num: "3", title: "Invista com Confiança", desc: "Tome decisões baseadas em dados reais" },
  ];

  const testimonials = [
    { name: "Carlos M.", role: "Investidor", text: "A VALUATION transformou minha forma de investir. Resultados acima da expectativa.", rating: 5 },
    { name: "Marina S.", role: "Empreendedora", text: "Carteira PRO tem me dado resultados consistentes. Recomendo!", rating: 5 },
    { name: "Roberto A.", role: "Engenheiro", text: "Economia de 10h/semana em pesquisas. Análises profissionais fazem diferença.", rating: 5 },
  ];

  const scrollToForm = () => {
    document.getElementById("lead-form")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <>
      <Helmet>
        <title>VALUATION Invest Tech - Análises e Carteiras de Investimento</title>
        <meta name="description" content="Descubra como investir com análises profissionais, carteiras recomendadas e conteúdos exclusivos. Acesse grátis!" />
      </Helmet>

      <div className="min-h-screen bg-background">
        {/* Premium Hero */}
        <section className="relative bg-gradient-to-br from-white via-gray-50 to-gray-100 py-20 md:py-32 overflow-hidden">
          {/* Dot grid pattern */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.04]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='24' height='24' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='2' cy='2' r='1.5' fill='%23b8860b'/%3E%3C/svg%3E")`,
              backgroundSize: '24px 24px',
            }}
          />

          {/* Radial golden glow */}
          <div
            className="absolute top-1/2 left-1/2 w-[800px] h-[800px] -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{
              background: 'radial-gradient(circle, hsl(var(--accent) / 0.08) 0%, transparent 70%)',
            }}
          />

          {/* Blur circles (enhanced) */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-accent/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-accent/8 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4 pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 w-[600px] h-[600px] bg-accent/6 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />

          {/* Diagonal lines */}
          <div className="absolute top-0 left-[15%] w-px h-[140%] bg-accent/10 -rotate-[25deg] origin-top pointer-events-none" />
          <div className="absolute top-0 right-[25%] w-px h-[140%] bg-accent/[0.06] -rotate-[20deg] origin-top pointer-events-none" />
          <div className="absolute top-0 left-[60%] w-px h-[140%] bg-accent/[0.04] -rotate-[30deg] origin-top pointer-events-none" />

          {/* Concentric ring */}
          <div className="absolute -top-32 -right-32 w-[400px] h-[400px] rounded-full border-2 border-accent/10 pointer-events-none" />
          <div className="absolute -top-32 -right-32 w-[320px] h-[320px] rounded-full border border-accent/[0.06] pointer-events-none mt-10 mr-10" />

          {/* Geometric shapes (SVG) */}
          <svg className="absolute bottom-10 left-10 w-32 h-32 pointer-events-none opacity-[0.07]" viewBox="0 0 100 100">
            <polygon points="50,5 95,95 5,95" fill="none" stroke="hsl(var(--accent))" strokeWidth="1.5" />
          </svg>
          <svg className="absolute top-20 right-[10%] w-20 h-20 pointer-events-none opacity-[0.06]" viewBox="0 0 100 100">
            <rect x="15" y="15" width="70" height="70" fill="none" stroke="hsl(var(--accent))" strokeWidth="1.5" transform="rotate(45 50 50)" />
          </svg>

          <div className="container max-w-6xl mx-auto px-4 relative z-10">
            {/* Logo integrated */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="mb-12 md:mb-16"
            >
              <img src="/logo.webp" alt="VALUATION Invest Tech" className="h-10 md:h-12" />
            </motion.div>

            <div className="grid md:grid-cols-2 gap-12 items-center">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="space-y-7"
              >
                <div className="inline-block bg-accent/10 text-accent border border-accent/20 px-5 py-2 rounded-full text-sm font-semibold tracking-wide">
                  🔥 Acesso Gratuito Disponível
                </div>
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-[1.1] text-gray-900">
                  Invista com <span className="text-accent">Inteligência</span> e Resultados Reais
                </h1>
                <p className="text-lg md:text-xl text-gray-500 leading-relaxed max-w-lg">
                  Análises profissionais de FIIs, Ações e BDRs. Carteiras recomendadas por especialistas. Tudo o que você precisa para investir melhor.
                </p>
                <Button onClick={scrollToForm} size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 font-bold text-lg px-10 py-7 shadow-lg shadow-accent/20">
                  Quero Conhecer Grátis <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </motion.div>

              {/* Video */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="relative aspect-video rounded-2xl overflow-hidden shadow-2xl border border-accent/20 ring-1 ring-accent/10"
              >
                {showVideo ? (
                  <iframe
                    src="https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0"
                    className="absolute inset-0 w-full h-full"
                    allow="autoplay; encrypted-media"
                    allowFullScreen
                    title="Demonstração VALUATION"
                  />
                ) : (
                  <button
                    onClick={() => setShowVideo(true)}
                    className="absolute inset-0 w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex flex-col items-center justify-center gap-4 hover:from-gray-50 hover:to-gray-150 transition-all cursor-pointer"
                    aria-label="Reproduzir vídeo de demonstração"
                  >
                    <div className="w-20 h-20 rounded-full bg-accent flex items-center justify-center shadow-xl shadow-accent/30">
                      <Play className="h-10 w-10 text-accent-foreground ml-1" />
                    </div>
                    <span className="text-gray-700 font-semibold text-lg">Assista a Demonstração</span>
                  </button>
                )}
              </motion.div>
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section className="py-16 md:py-20">
          <div className="container max-w-6xl mx-auto px-4">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">
              Por que escolher a <span className="text-accent">VALUATION</span>?
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {benefits.map((b, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 25 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                >
                  <Card className="p-6 text-center hover:shadow-lg transition-shadow border-accent/10 hover:border-accent/30 h-full">
                    <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
                      <b.icon className="h-7 w-7 text-accent" />
                    </div>
                    <h3 className="font-bold mb-2">{b.title}</h3>
                    <p className="text-sm text-muted-foreground">{b.desc}</p>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Como Funciona */}
        <section className="py-16 md:py-20 bg-muted/50">
          <div className="container max-w-6xl mx-auto px-4">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">
              Como <span className="text-accent">Funciona</span>?
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              {steps.map((s, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.5, delay: i * 0.15 }}
                  className="text-center space-y-3"
                >
                  <div className="w-12 h-12 rounded-full bg-accent text-accent-foreground font-bold text-xl flex items-center justify-center mx-auto">
                    {s.num}
                  </div>
                  <h3 className="font-bold text-lg">{s.title}</h3>
                  <p className="text-muted-foreground text-sm">{s.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Social proof */}
        <section className="py-16">
          <div className="container max-w-5xl mx-auto px-4">
            <div className="flex justify-center mb-4">
              <Quote className="h-10 w-10 text-accent" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-10">O Que Nossos Clientes Dizem</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {testimonials.map((t, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                >
                  <Card className="p-6 h-full">
                    <div className="flex gap-1 mb-3">
                      {[...Array(t.rating)].map((_, j) => (
                        <Star key={j} className="h-4 w-4 fill-accent text-accent" />
                      ))}
                    </div>
                    <p className="text-muted-foreground mb-4 text-sm leading-relaxed">"{t.text}"</p>
                    <div className="border-t pt-3">
                      <p className="font-semibold text-sm">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.role}</p>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
            <div className="mt-10 grid grid-cols-3 gap-6 max-w-md mx-auto text-center">
              <div>
                <p className="text-2xl font-bold text-accent">5.000+</p>
                <p className="text-xs text-muted-foreground">Investidores</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-accent">4.9/5</p>
                <p className="text-xs text-muted-foreground">Avaliação</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-accent">98%</p>
                <p className="text-xs text-muted-foreground">Satisfação</p>
              </div>
            </div>
          </div>
        </section>

        {/* Signup form */}
        <section id="lead-form" className="py-16 bg-foreground">
          <div className="container max-w-lg mx-auto px-4">
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-3xl font-bold mb-3 text-background">
                Comece Agora — <span className="text-accent">É Grátis!</span>
              </h2>
              <p className="text-background/70">
                Cadastre-se e receba acesso imediato às análises e carteiras recomendadas.
              </p>
            </div>
            <SignupForm
              plan="FREE"
              onSuccess={() => navigate("/app/dashboard")}
              buttonText="Quero Conhecer Grátis"
              buttonClassName="bg-accent text-accent-foreground hover:bg-accent/90 font-bold text-lg py-6"
            />
            <p className="text-xs text-muted-foreground text-center mt-4">
              Ao se cadastrar, você concorda com nossos{" "}
              <a href="/termos-uso" className="underline">Termos de Uso</a> e{" "}
              <a href="/politica-privacidade" className="underline">Política de Privacidade</a>.
            </p>
            <p className="text-center text-background/60 text-sm mt-6">
              ⏰ Acesso gratuito por tempo limitado. Garanta o seu agora!
            </p>
          </div>
        </section>

        {/* Mini footer */}
        <footer className="py-6 text-center text-xs text-muted-foreground bg-background border-t">
          © 2026 VALUATION Invest Tech. Todos os direitos reservados.
        </footer>
      </div>
    </>
  );
};

export default LandingPage;
