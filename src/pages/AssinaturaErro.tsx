import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { XCircle, CreditCard, RefreshCw, MessageCircle, ArrowLeft } from "lucide-react";
import SEOHead from "@/components/SEOHead";
import logo from "@/assets/logo.webp";

interface ErrorItemProps {
  icon: React.ReactNode;
  text: string;
  delay: number;
}

const ErrorItem = ({ icon, text, delay }: ErrorItemProps) => (
  <div 
    className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800 animate-fade-in"
    style={{ animationDelay: `${delay}ms` }}
  >
    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
      {icon}
    </div>
    <span className="text-sm font-medium text-red-700 dark:text-red-300">
      {text}
    </span>
  </div>
);

const AssinaturaErro = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Get error reason from URL params if available
  const errorReason = searchParams.get("reason");
  
  const getErrorMessage = () => {
    switch (errorReason) {
      case "cancelled":
        return "Você cancelou o processo de pagamento.";
      case "declined":
        return "Seu cartão foi recusado. Verifique os dados e tente novamente.";
      case "expired":
        return "A sessão de pagamento expirou.";
      case "insufficient_funds":
        return "Fundos insuficientes no cartão.";
      default:
        return "Ocorreu um problema durante o processamento do pagamento.";
    }
  };

  const errorItems = [
    { icon: <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />, text: "Pagamento não concluído" },
    { icon: <CreditCard className="h-4 w-4 text-red-600 dark:text-red-400" />, text: "Nenhuma cobrança foi realizada" },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50/50 via-background to-orange-50/30 dark:from-red-950/20 dark:via-background dark:to-orange-950/20 p-4">
      <SEOHead
        title="Erro no Pagamento - Assinatura não Concluída"
        description="Ocorreu um problema durante o processamento do seu pagamento. Tente novamente ou entre em contato com nosso suporte."
        canonical="https://valuationit.com.br/assinatura-erro"
        noindex={true}
      />
      <Card className="w-full max-w-md shadow-2xl border-red-100 dark:border-red-900/50 overflow-hidden">
        {/* Error gradient header */}
        <div className="h-2 bg-gradient-to-r from-red-400 via-orange-500 to-red-400" />
        
        <CardHeader className="text-center pb-4">
          {/* Company Logo */}
          <img 
            src={logo} 
            alt="Valuation Invest Tech" 
            className="h-10 mx-auto mb-6 dark:brightness-110"
          />
          
          {/* Error icon */}
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/50 mb-4 mx-auto">
            <XCircle className="h-12 w-12 text-red-500" />
          </div>
          
          <CardTitle className="text-2xl text-red-700 dark:text-red-400">
            Pagamento não Concluído
          </CardTitle>
          
          <CardDescription className="text-base mt-2">
            {getErrorMessage()}
            <span className="block mt-2 text-muted-foreground">
              Não se preocupe, você pode tentar novamente.
            </span>
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Error items */}
          <div className="space-y-3">
            {errorItems.map((item, index) => (
              <ErrorItem
                key={index}
                icon={item.icon}
                text={item.text}
                delay={index * 200}
              />
            ))}
          </div>
          
          {/* Help text */}
          <div className="bg-muted/50 p-4 rounded-lg border border-border">
            <p className="text-sm text-muted-foreground">
              <strong>Possíveis soluções:</strong>
            </p>
            <ul className="text-sm text-muted-foreground mt-2 space-y-1 list-disc list-inside">
              <li>Verifique os dados do cartão</li>
              <li>Tente outro método de pagamento</li>
              <li>Entre em contato com seu banco</li>
            </ul>
          </div>
          
          {/* Action buttons */}
          <div className="space-y-2 pt-2">
            <Button 
              onClick={() => navigate("/assinatura")} 
              className="w-full bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700"
              size="lg"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Tentar Novamente
            </Button>
            
            <Button 
              onClick={() => navigate("/contato")} 
              variant="outline"
              className="w-full border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950/30"
              size="lg"
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              Falar com Suporte
            </Button>
            
            <Button 
              onClick={() => navigate("/")} 
              variant="ghost"
              className="w-full text-muted-foreground hover:text-foreground"
              size="lg"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar ao Início
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AssinaturaErro;
