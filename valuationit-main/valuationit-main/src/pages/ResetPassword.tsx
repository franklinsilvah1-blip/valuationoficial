import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff } from "lucide-react";
import { z } from "zod";
import logo from "@/assets/logo.webp";
import SEOHead from "@/components/SEOHead";

const passwordSchema = z.object({
  password: z.string().min(6, { message: "Senha deve ter no mínimo 6 caracteres" }),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

const ResetPassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [linkExpired, setLinkExpired] = useState(false);
  const [checkingLink, setCheckingLink] = useState(true);
  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  });

  useEffect(() => {
    // Verificar se há parâmetros de erro na URL (como otp_expired)
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const error = hashParams.get('error');
    const errorCode = hashParams.get('error_code');
    const errorDescription = hashParams.get('error_description');

    console.log("[ResetPassword] URL hash params:", { error, errorCode, errorDescription });

    if (error === 'access_denied' || errorCode === 'otp_expired') {
      console.log("[ResetPassword] Link expired or invalid from URL params");
      setLinkExpired(true);
      toast({
        title: "Link expirado",
        description: errorDescription?.replace(/\+/g, ' ') || "Este link de recuperação expirou ou já foi usado.",
        variant: "destructive",
      });
      setCheckingLink(false);
      return;
    }

    // Verificar se há uma sessão de recuperação ativa
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        console.log("[ResetPassword] Session check:", { hasSession: !!session, error });
        
        if (error || !session) {
          setLinkExpired(true);
          toast({
            title: "Link expirado",
            description: "Este link de recuperação expirou. Links são válidos por 1 hora.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Erro ao verificar sessão:", error);
        setLinkExpired(true);
      } finally {
        setCheckingLink(false);
      }
    };
    checkSession();
  }, [toast]);

  const handleRequestNewLink = () => {
    navigate("/auth");
    toast({
      title: "Solicite um novo link",
      description: "Use a opção 'Esqueci minha senha' para receber um novo link.",
    });
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validated = passwordSchema.parse(formData);

      const { error } = await supabase.auth.updateUser({
        password: validated.password,
      });

      if (error) {
        // Detectar se o link expirou durante a tentativa
        if (error.message.includes("session") || error.message.includes("expired") || error.message.includes("invalid")) {
          setLinkExpired(true);
          toast({
            title: "Link expirado",
            description: "Este link de recuperação expirou durante a redefinição. Solicite um novo link.",
            variant: "destructive",
          });
          return;
        }
        throw error;
      }

      toast({
        title: "Senha redefinida!",
        description: "Sua senha foi atualizada com sucesso.",
      });

      // Aguardar um momento antes de redirecionar
      setTimeout(() => {
        navigate("/auth");
      }, 1500);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Erro de validação",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro ao redefinir senha",
          description: error.message,
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  if (checkingLink) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/30 p-4">
        <div className="text-center">
          <Link to="/" className="inline-block mb-4 hover:opacity-80 transition-opacity">
            <img src={logo} alt="VALUATION Invest tech" className="h-16 w-auto mx-auto" />
          </Link>
          <p className="text-muted-foreground">Verificando link de recuperação...</p>
        </div>
      </div>
    );
  }

  if (linkExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/30 p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link to="/" className="inline-block mb-4 hover:opacity-80 transition-opacity">
              <img src={logo} alt="VALUATION Invest tech" className="h-16 w-auto mx-auto" />
            </Link>
            <h1 className="text-3xl font-bold">Link Expirado</h1>
            <p className="text-muted-foreground mt-2">Este link de recuperação não é mais válido</p>
          </div>

          <Card className="shadow-elevated">
            <CardHeader>
              <CardTitle>Link de Recuperação Expirado</CardTitle>
              <CardDescription>
                Por motivos de segurança, links de recuperação expiram após 1 hora.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Para redefinir sua senha, você precisará solicitar um novo link de recuperação.
                  O processo é rápido e seguro.
                </p>
              </div>
              <Button 
                onClick={handleRequestNewLink}
                className="w-full"
              >
                Solicitar Novo Link
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/30 p-4">
      <SEOHead
        title="Redefinir Senha - VALUATION Invest Tech"
        description="Redefina sua senha de acesso à plataforma VALUATION Invest Tech."
        canonical="https://valuationit.com.br/reset-password"
        noindex={true}
        ogImage="https://valuationit.com.br/og-image.png"
      />
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-block mb-4 hover:opacity-80 transition-opacity">
            <img src={logo} alt="VALUATION Invest tech" className="h-16 w-auto mx-auto" />
          </Link>
          <h1 className="text-3xl font-bold">Redefinir Senha</h1>
          <p className="text-muted-foreground mt-2">Digite sua nova senha</p>
        </div>

        <Card className="shadow-elevated">
          <CardHeader>
            <CardTitle>Nova Senha</CardTitle>
            <CardDescription>
              Escolha uma senha forte e segura. Este link expira em 1 hora.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Nova Senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Mínimo de 6 caracteres
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Redefinindo..." : "Redefinir Senha"}
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => navigate("/auth")}
              >
                Voltar ao login
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ResetPassword;
