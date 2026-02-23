import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home, ArrowLeft, Search } from "lucide-react";
import SEOHead from "@/components/SEOHead";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center px-4">
      <SEOHead
        title="Página Não Encontrada - 404"
        description="A página que você está procurando não existe ou foi movida. Volte para a página inicial da VALUATION Invest Tech."
        noindex={true}
      />
      
      <main className="text-center max-w-md mx-auto">
        {/* 404 Number */}
        <div className="mb-8">
          <h1 className="text-8xl md:text-9xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
            404
          </h1>
        </div>

        {/* Message */}
        <div className="mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
            Página não encontrada
          </h2>
          <p className="text-muted-foreground">
            Ops! A página que você está procurando não existe ou foi movida. 
            Não se preocupe, você pode voltar para a página inicial ou explorar nosso mercado.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/">
            <Button size="lg" className="w-full sm:w-auto gradient-cta text-accent-foreground font-semibold">
              <Home className="mr-2 h-5 w-5" />
              Página Inicial
            </Button>
          </Link>
          <Link to="/mercado">
            <Button size="lg" variant="outline" className="w-full sm:w-auto">
              <Search className="mr-2 h-5 w-5" />
              Explorar Mercado
            </Button>
          </Link>
        </div>

        {/* Back Link */}
        <div className="mt-8">
          <button 
            onClick={() => window.history.back()} 
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Voltar à página anterior
          </button>
        </div>

        {/* Helpful Links */}
        <nav className="mt-12 pt-8 border-t border-border">
          <p className="text-sm text-muted-foreground mb-4">Links úteis:</p>
          <ul className="flex flex-wrap justify-center gap-4 text-sm">
            <li>
              <Link to="/assinatura" className="text-primary hover:underline">
                Planos e Preços
              </Link>
            </li>
            <li>
              <Link to="/blog" className="text-primary hover:underline">
                Blog
              </Link>
            </li>
            <li>
              <Link to="/contato" className="text-primary hover:underline">
                Contato
              </Link>
            </li>
            <li>
              <Link to="/consultoria" className="text-primary hover:underline">
                Consultoria
              </Link>
            </li>
          </ul>
        </nav>
      </main>
    </div>
  );
};

export default NotFound;
