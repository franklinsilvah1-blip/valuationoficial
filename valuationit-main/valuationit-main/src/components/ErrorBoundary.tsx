import { Component, ErrorInfo, ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Home, RefreshCw, ArrowLeft, Mail, AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ errorInfo });
    
    // Here you could also send the error to an error reporting service
    // Example: logErrorToService(error, errorInfo);
  }

  handleRefresh = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center px-4">
          <main className="text-center max-w-md mx-auto">
            {/* Error Icon */}
            <div className="mb-8">
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-destructive/10 mb-4">
                <AlertTriangle className="h-12 w-12 text-destructive" />
              </div>
              <h1 className="text-6xl md:text-7xl font-bold bg-gradient-to-r from-destructive to-destructive/60 bg-clip-text text-transparent">
                500
              </h1>
            </div>

            {/* Message */}
            <div className="mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
                Algo deu errado
              </h2>
              <p className="text-muted-foreground mb-4">
                Ocorreu um erro inesperado na aplicação. Nossa equipe técnica foi 
                notificada e está trabalhando para resolver o problema.
              </p>
              <p className="text-sm text-muted-foreground">
                Por favor, tente recarregar a página.
              </p>
            </div>

            {/* Error details in development */}
            {process.env.NODE_ENV === "development" && this.state.error && (
              <div className="mb-8 p-4 bg-destructive/5 border border-destructive/20 rounded-lg text-left overflow-auto max-h-40">
                <p className="text-xs font-mono text-destructive">
                  {this.state.error.toString()}
                </p>
                {this.state.errorInfo && (
                  <pre className="text-xs font-mono text-muted-foreground mt-2 whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                onClick={this.handleRefresh}
                className="w-full sm:w-auto gradient-cta text-accent-foreground font-semibold"
              >
                <RefreshCw className="mr-2 h-5 w-5" />
                Recarregar Página
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                onClick={() => window.location.href = "/"}
                className="w-full sm:w-auto"
              >
                <Home className="mr-2 h-5 w-5" />
                Página Inicial
              </Button>
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
              <a 
                href="/contato" 
                className="inline-flex items-center text-primary hover:underline"
              >
                <Mail className="mr-2 h-4 w-4" />
                Fale Conosco
              </a>
            </div>

            {/* Helpful Links */}
            <nav className="mt-8 pt-6 border-t border-border">
              <p className="text-sm text-muted-foreground mb-4">Links úteis:</p>
              <ul className="flex flex-wrap justify-center gap-4 text-sm">
                <li>
                  <a href="/mercado" className="text-primary hover:underline">
                    Mercado
                  </a>
                </li>
                <li>
                  <a href="/assinatura" className="text-primary hover:underline">
                    Planos
                  </a>
                </li>
                <li>
                  <a href="/blog" className="text-primary hover:underline">
                    Blog
                  </a>
                </li>
                <li>
                  <a href="/sobre" className="text-primary hover:underline">
                    Sobre
                  </a>
                </li>
              </ul>
            </nav>
          </main>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
