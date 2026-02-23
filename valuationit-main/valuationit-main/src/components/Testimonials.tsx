import { Card } from "@/components/ui/card";
import { Star, Quote } from "lucide-react";
import { Helmet } from "react-helmet";
import { createReviewSchema } from "@/components/SEOHead";

interface Testimonial {
  name: string;
  role: string;
  company?: string;
  image?: string;
  rating: number;
  testimonial: string;
  result?: string;
}

const testimonials: Testimonial[] = [{
  name: "Carlos Mendes",
  role: "Investidor Independente",
  rating: 5,
  testimonial: "A VALUATION transformou completamente minha forma de investir. As análises são profundas e me ajudaram a identificar oportunidades que eu nunca teria encontrado sozinho.",
  result: "Resultados acima da expectativa inicial"
}, {
  name: "Marina Silva",
  role: "Empreendedora",
  company: "Tech Solutions",
  rating: 5,
  testimonial: "Como empreendedora, preciso de análises confiáveis para investir meu capital de forma inteligente. A carteira PRO da VALUATION tem me dado resultados consistentes.",
  result: "Portfólio diversificado e equilibrado"
}, {
  name: "Roberto Almeida",
  role: "Engenheiro",
  rating: 5,
  testimonial: "Antes de conhecer a VALUATION, eu perdia muito tempo tentando analisar ações por conta própria. Agora tenho acesso a análises profissionais que realmente fazem diferença.",
  result: "Economia de 10h/semana em pesquisas"
}, {
  name: "Ana Paula Costa",
  role: "Professora Universitária",
  rating: 5,
  testimonial: "A qualidade das recomendações e a clareza das análises me deram confiança para começar a investir. Os primeiros meses já mostraram resultados positivos no meu patrimônio.",
  result: "Crescimento consistente do patrimônio"
}, {
  name: "Fernando Santos",
  role: "Contador",
  company: "Santos & Associados",
  rating: 5,
  testimonial: "Uso a VALUATION para minhas decisões pessoais e também recomendo para meus clientes. A precisão das análises e o acompanhamento em tempo real são diferenciais únicos.",
  result: "Recomendado para diversos clientes"
}, {
  name: "Juliana Rodrigues",
  role: "Gestora de Projetos",
  rating: 5,
  testimonial: "A carteira SPECIALIST tem ativos que eu nunca teria considerado. Os resultados superaram minhas expectativas e agora tenho uma estratégia muito mais sólida.",
  result: "Estratégia de investimento aprimorada"
}];

// Generate review schema from testimonials
const reviewSchemaData = createReviewSchema(
  testimonials.map((t) => ({
    author: t.name,
    reviewBody: t.testimonial,
    rating: t.rating,
  })),
  4.9,
  5000
);

const Testimonials = () => {
  return (
    <>
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify(reviewSchemaData)}
        </script>
      </Helmet>
      <section className="py-12 md:py-20 bg-background">
        <div className="container">
          <div className="text-center mb-8 md:mb-12 animate-fade-in">
            <div className="flex justify-center mb-4">
              <Quote className="h-12 w-12 text-accent" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              O Que Nossos Clientes Dizem
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">Histórias reais de investidores que transformaram seus resultados e ganhos com a ValuAtion</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {testimonials.map((testimonial, index) => (
              <article 
                key={index} 
                className="p-6 shadow-card hover:shadow-elevated transition-all duration-300 hover:-translate-y-1 animate-slide-up bg-card rounded-xl border"
                style={{ animationDelay: `${index * 0.1}s` }}
                itemScope
                itemType="https://schema.org/Review"
              >
                {/* itemReviewed - Required for Google Review snippets */}
                <div itemProp="itemReviewed" itemScope itemType="https://schema.org/Organization" className="hidden">
                  <meta itemProp="name" content="VALUATION Invest Tech" />
                  <meta itemProp="url" content="https://valuationit.com.br" />
                </div>

                {/* Rating */}
                <div className="flex gap-1 mb-4" itemProp="reviewRating" itemScope itemType="https://schema.org/Rating">
                  <meta itemProp="ratingValue" content={testimonial.rating.toString()} />
                  <meta itemProp="bestRating" content="5" />
                  {[...Array(testimonial.rating)].map((_, i) => <Star key={i} className="h-4 w-4 fill-accent text-accent" />)}
                </div>

                {/* Testimonial Text */}
                <p className="text-muted-foreground mb-4 leading-relaxed" itemProp="reviewBody">
                  "{testimonial.testimonial}"
                </p>

                {/* Result Badge */}
                {testimonial.result && (
                  <div className="mb-4 p-3 bg-accent/10 rounded-lg border border-accent/20">
                    <p className="text-sm font-semibold text-accent">
                      ✓ {testimonial.result}
                    </p>
                  </div>
                )}

                {/* Author Info */}
                <footer className="pt-4 border-t" itemProp="author" itemScope itemType="https://schema.org/Person">
                  <p className="font-semibold text-foreground" itemProp="name">{testimonial.name}</p>
                  <p className="text-sm text-muted-foreground">
                    <span itemProp="jobTitle">{testimonial.role}</span>
                    {testimonial.company && <span> • <span itemProp="worksFor">{testimonial.company}</span></span>}
                  </p>
                </footer>
              </article>
            ))}
          </div>

          {/* Trust Indicators */}
          <div className="mt-10 md:mt-16 text-center">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-3xl mx-auto">
              <div>
                <p className="text-4xl font-bold text-accent mb-2">5.000+</p>
                <p className="text-muted-foreground">Investidores Ativos</p>
              </div>
              <div>
                <p className="text-4xl font-bold text-accent mb-2">4.9/5</p>
                <p className="text-muted-foreground">Avaliação Média</p>
              </div>
              <div>
                <p className="text-4xl font-bold text-accent mb-2">98%</p>
                <p className="text-muted-foreground">Taxa de Satisfação</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default Testimonials;