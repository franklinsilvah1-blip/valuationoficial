import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Loader2, CreditCard, Wallet, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { trackSubscriptionSuccess } from "@/utils/gtmTracking";
import SEOHead from "@/components/SEOHead";
import logo from "@/assets/logo.webp";

interface ConfirmationItemProps {
  icon: React.ReactNode;
  text: string;
  delay: number;
  isVisible: boolean;
}

const ConfirmationItem = ({ icon, text, delay, isVisible }: ConfirmationItemProps) => (
  <div 
    className={`flex items-center gap-3 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800 transition-all duration-500 ${
      isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'
    }`}
    style={{ transitionDelay: `${delay}ms` }}
  >
    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
      {icon}
    </div>
    <span className="text-sm font-medium text-green-700 dark:text-green-300">
      {text}
    </span>
  </div>
);

const AssinaturaSucesso = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { refreshSubscription } = useAuth();
  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState(false);
  const [planName, setPlanName] = useState<string | null>(null);
  const [showItems, setShowItems] = useState(false);

  useEffect(() => {
    const verifySubscription = async () => {
      const sessionId = searchParams.get("session_id");
      
      if (!sessionId) {
        toast({
          title: "Erro",
          description: "Sessão de pagamento não encontrada",
          variant: "destructive",
        });
        navigate("/assinatura");
        return;
      }

      try {
        console.log("[AssinaturaSucesso] Starting verification process");
        
        // Wait for webhook to process first
        await new Promise(resolve => setTimeout(resolve, 2000));

        // FIRST: Call check-subscription which syncs with Stripe and updates database
        // This is the fallback if webhook didn't fire
        console.log("[AssinaturaSucesso] Calling check-subscription to sync with Stripe");
        const { data, error } = await supabase.functions.invoke("check-subscription");
        
        if (!error && data?.subscribed && data?.plan !== "FREE") {
          console.log("[AssinaturaSucesso] Subscription verified via check-subscription", data);
          
          // Track subscription success (GTM)
          const planPrice = data.plan === 'START' ? 'R$ 147' : data.plan === 'PRO' ? 'R$ 297' : 'R$ 0';
          trackSubscriptionSuccess(data.plan, planPrice);
          
          // Update local state
          await refreshSubscription();
          
          // Track Purchase event
          if (typeof window !== 'undefined' && (window as any).fbq) {
            (window as any).fbq('track', 'Purchase', {
              content_name: data.plan,
              content_category: 'Subscription',
              value: data.plan === 'START' ? 147 : data.plan === 'PRO' ? 297 : 0,
              currency: 'BRL'
            });
            console.log('✅ Facebook Pixel: Purchase tracked for', data.plan);
          }
          
          setPlanName(data.plan);
          setVerified(true);
          toast({
            title: "Assinatura ativada!",
            description: `Seu plano ${data.plan} está ativo.`,
          });
          setLoading(false);
          
          // Trigger animation after a short delay
          setTimeout(() => setShowItems(true), 300);
          return;
        }
        
        // If still not found, wait and try again (webhook may be slow)
        console.log("[AssinaturaSucesso] First attempt failed, waiting and retrying...");
        await new Promise(resolve => setTimeout(resolve, 4000));
        
        const { data: retryData, error: retryError } = await supabase.functions.invoke("check-subscription");
        
        if (!retryError && retryData?.subscribed && retryData?.plan !== "FREE") {
          console.log("[AssinaturaSucesso] Subscription verified on retry", retryData);
          
          await refreshSubscription();
          
          // Track Purchase event
          if (typeof window !== 'undefined' && (window as any).fbq) {
            (window as any).fbq('track', 'Purchase', {
              content_name: retryData.plan,
              content_category: 'Subscription',
              value: retryData.plan === 'START' ? 147 : retryData.plan === 'PRO' ? 297 : 0,
              currency: 'BRL'
            });
            console.log('✅ Facebook Pixel: Purchase tracked for', retryData.plan);
          }
          
          setPlanName(retryData.plan);
          setVerified(true);
          toast({
            title: "Assinatura ativada!",
            description: `Seu plano ${retryData.plan} está ativo.`,
          });
          setLoading(false);
          
          // Trigger animation after a short delay
          setTimeout(() => setShowItems(true), 300);
          return;
        }
        
        // Still not found - show processing message
        console.warn("[AssinaturaSucesso] Subscription not found after retries", { 
          error: retryError, 
          data: retryData 
        });
        toast({
          title: "Processando assinatura",
          description: "Sua assinatura está sendo ativada. Clique em 'Sincronizar' se demorar mais de 1 minuto.",
          duration: 10000,
        });
        setVerified(false);
        
      } catch (error: any) {
        console.error("[AssinaturaSucesso] Error during verification:", error);
        toast({
          title: "Atenção",
          description: "Sua assinatura está sendo processada. Use o botão 'Sincronizar' para atualizar.",
          duration: 10000,
        });
      } finally {
        setLoading(false);
      }
    };

    verifySubscription();
  }, [searchParams, navigate, toast]);

  const confirmationItems = [
    { icon: <CreditCard className="h-4 w-4 text-green-600 dark:text-green-400" />, text: "Pagamento confirmado com sucesso" },
    { icon: <Wallet className="h-4 w-4 text-green-600 dark:text-green-400" />, text: "Acesso às carteiras liberado" },
    { icon: <Mail className="h-4 w-4 text-green-600 dark:text-green-400" />, text: "Email de confirmação enviado" },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50/50 via-background to-emerald-50/30 dark:from-green-950/20 dark:via-background dark:to-emerald-950/20 p-4">
      <SEOHead
        title="Assinatura Confirmada - Pagamento Processado com Sucesso"
        description="Sua assinatura foi confirmada com sucesso. Acesse agora sua área do cliente e comece a explorar as análises exclusivas."
        canonical="https://valuationit.com.br/assinatura-sucesso"
        noindex={true}
      />
      <Card className="w-full max-w-md shadow-2xl border-green-100 dark:border-green-900/50 overflow-hidden">
        {/* Success gradient header */}
        {verified && (
          <div className="h-2 bg-gradient-to-r from-green-400 via-emerald-500 to-green-400" />
        )}
        
        <CardHeader className="text-center pb-4">
          {/* Company Logo */}
          <img 
            src={logo} 
            alt="Valuation Invest Tech" 
            className="h-10 mx-auto mb-6 dark:brightness-110"
          />
          
          {loading ? (
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-4 mx-auto">
              <Loader2 className="h-10 w-10 text-primary animate-spin" />
            </div>
          ) : verified ? (
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/50 mb-4 mx-auto animate-[pulse_2s_ease-in-out_infinite]">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
            </div>
          ) : (
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-amber-100 dark:bg-amber-900/50 mb-4 mx-auto">
              <Loader2 className="h-10 w-10 text-amber-500 animate-spin" />
            </div>
          )}
          
          <CardTitle className={`text-2xl ${verified ? 'text-green-700 dark:text-green-400' : ''}`}>
            {loading ? "Verificando pagamento..." : verified ? "Assinatura Confirmada!" : "Processando..."}
          </CardTitle>
          
          <CardDescription className="text-base mt-2">
            {loading
              ? "Estamos confirmando seu pagamento. Por favor, aguarde..."
              : verified
              ? (
                <>
                  Parabéns! Você agora faz parte da{" "}
                  <span className="font-semibold text-foreground">Valuation Invest Tech</span>
                  {planName && (
                    <span className="block mt-1 text-green-600 dark:text-green-400 font-medium">
                      Plano {planName} ativado
                    </span>
                  )}
                </>
              )
              : "Sua assinatura está sendo ativada. Isso pode levar alguns instantes."}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Confirmation items with animation */}
          {!loading && (
            <div className="space-y-3">
              {confirmationItems.map((item, index) => (
                <ConfirmationItem
                  key={index}
                  icon={item.icon}
                  text={item.text}
                  delay={index * 200}
                  isVisible={verified ? showItems : true}
                />
              ))}
            </div>
          )}
          
          {/* Action buttons */}
          <div className="space-y-2 pt-2">
            <Button 
              onClick={() => navigate("/app/dashboard")} 
              className={`w-full ${verified ? 'bg-green-600 hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700' : ''}`}
              disabled={loading}
              size="lg"
            >
              {loading ? "Aguarde..." : "Acessar Área do Cliente"}
            </Button>
            
            {!loading && !verified && (
              <Button 
                onClick={() => window.location.reload()} 
                variant="outline"
                className="w-full border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/30"
                size="lg"
              >
                <Loader2 className="mr-2 h-4 w-4" />
                Sincronizar Assinatura
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AssinaturaSucesso;
