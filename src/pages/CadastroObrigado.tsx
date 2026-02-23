import { useEffect, useMemo } from "react";
import { Helmet } from "react-helmet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle, ArrowRight, BarChart3, BookOpen } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { pushGTMEvent } from "@/utils/gtmTracking";
import { motion } from "framer-motion";

const CadastroObrigado = () => {
  const [searchParams] = useSearchParams();

  const plan = useMemo(() => searchParams.get("plan") || "FREE", [searchParams]);
  const utmSource = searchParams.get("utm_source");

  // Fire conversion events once on mount
  useEffect(() => {
    // Meta Pixel: CompleteRegistration
    if (typeof window !== "undefined" && (window as any).fbq) {
      (window as any).fbq("track", "CompleteRegistration", {
        content_name: plan,
        value: 0,
        currency: "BRL",
      });
    }

    // GTM: sign_up_complete
    pushGTMEvent({
      event: "sign_up_complete",
      plan,
      utm_source: utmSource || "direct",
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <Helmet>
        <title>Cadastro Realizado! - VALUATION Invest Tech</title>
        <meta
          name="description"
          content="Sua conta foi criada com sucesso. Acesse a plataforma agora."
        />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-lg w-full text-center space-y-8 py-16">
          {/* Animated checkmark */}
          <motion.div
            className="flex justify-center"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
          >
            <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle className="h-12 w-12 text-green-600" />
            </div>
          </motion.div>

          <motion.div
            className="space-y-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h1 className="text-3xl md:text-4xl font-bold">
              Conta Criada com Sucesso! 🎉
            </h1>
            <p className="text-muted-foreground text-lg">
              Sua conta já está ativa. Acesse a plataforma e comece a explorar.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="p-6 text-left space-y-4">
              <h2 className="font-bold text-lg">Próximos passos:</h2>
              <div className="space-y-3">
                <div className="flex gap-3 items-start">
                  <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-accent font-bold text-sm">1</span>
                  </div>
                  <div>
                    <p className="font-semibold">Confirme seu e-mail</p>
                    <p className="text-sm text-muted-foreground">
                      Enviamos um link de confirmação para sua caixa de entrada.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 items-start">
                  <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-accent font-bold text-sm">2</span>
                  </div>
                  <div>
                    <p className="font-semibold">Acesse a plataforma</p>
                    <p className="text-sm text-muted-foreground">
                      Explore análises de FIIs, Ações e BDRs em tempo real.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 items-start">
                  <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-accent font-bold text-sm">3</span>
                  </div>
                  <div>
                    <p className="font-semibold">Monte sua carteira</p>
                    <p className="text-sm text-muted-foreground">
                      Simule e acompanhe seus investimentos com facilidade.
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>

          <motion.div
            className="space-y-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            <Button
              asChild
              size="lg"
              className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-bold text-lg py-6"
            >
              <Link to="/app/dashboard">
                Acessar a Plataforma <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <div className="flex gap-3">
              <Button asChild variant="outline" className="flex-1">
                <Link to="/mercado">
                  <BarChart3 className="mr-2 h-4 w-4" /> Explorar Mercado
                </Link>
              </Button>
              <Button asChild variant="outline" className="flex-1">
                <Link to="/blog">
                  <BookOpen className="mr-2 h-4 w-4" /> Ler Blog
                </Link>
              </Button>
            </div>
          </motion.div>

          <div className="pt-4">
            <Button asChild variant="ghost" size="sm" className="text-accent">
              <Link to="/assinatura">Quero ver os planos pagos →</Link>
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            © 2026 VALUATION Invest Tech. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </>
  );
};

export default CadastroObrigado;
