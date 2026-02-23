import { Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home, ArrowLeft, RefreshCw, Mail } from "lucide-react";
import SEOHead from "@/components/SEOHead";

const ServerError = () => {
  useEffect(() => {
    console.error("500 Error: Server error page displayed");
  }, []);

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center px-4">
      <SEOHead
        title="Erro no Servidor - 500"
        description="Ocorreu um erro inesperado no servidor. Nossa equipe foi notificada e está trabalhando para resolver o problema."
        noindex={true}
        ogImage="https://valuationit.com.br/og-image.png"
      />
      
      <main className="text-center max-w-md mx-auto">
        {/* 500 Number */}
        <div className="mb-8">
          <h1 className="text-8xl md:text-9xl font-bold bg-gradient-to-r from-destructive to-destructive/60 bg-clip-text text-transparent">
            500
          </h1>
        </div>

        {/* Message */}
        <div className="mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
            Erro no servidor
          </h2>
          <p className="text-muted-foreground mb-4">
            Ops! Algo deu errado do nosso lado. Nossa equipe técnica já foi 
            notificada e está trabalhando para resolver o problema.
          </p>
          <p className="text-sm text-muted-foreground">
            Por favor, tente novamente em alguns minutos.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button 
            size="lg" 
            onClick={handleRefresh}
            className="w-full sm:w-auto gradient-cta text-accent-foreground font-semibold"
          >
            <RefreshCw className="mr-2 h-5 w-5" />
            Tentar Novamente
          </Button>
          <Link to="/">
            <Button size="lg" variant="outline" className="w-full sm:w-auto">
              <Home className="mr-2 h-5 w-5" />
              Página Inicial
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

        {/* Help Section */}
        <div className="mt-12 pt-8 border-t border-border">
          <p className="text-sm text-muted-foreground mb-4">
            Se o problema persistir, entre em contato:
          </p>
          <Link 
            to="/contato" 
            className="inline-flex items-center text-primary hover:underline"
          >
            <Mail className="mr-2 h-4 w-4" />
            Fale Conosco
          </Link>
        </div>

        {/* Helpful Links */}
        <nav className="mt-8 pt-6 border-t border-border">
          <p className="text-sm text-muted-foreground mb-4">Links úteis:</p>
          <ul className="flex flex-wrap justify-center gap-4 text-sm">
            <li>
              <Link to="/mercado" className="text-primary hover:underline">
                Mercado
              </Link>
            </li>
            <li>
              <Link to="/assinatura" className="text-primary hover:underline">
                Planos
              </Link>
            </li>
            <li>
              <Link to="/blog" className="text-primary hover:underline">
                Blog
              </Link>
            </li>
            <li>
              <Link to="/sobre" className="text-primary hover:underline">
                Sobre
              </Link>
            </li>
          </ul>
        </nav>
      </main>
    </div>
  );
};

export default ServerError;
