import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Clock, Mail, Wand2, CheckCircle, ArrowLeft } from "lucide-react";
import { z } from "zod";
import { TwoFactorVerify } from "@/components/TwoFactorVerify";
import SignupForm from "@/components/SignupForm";
import SEOHead from "@/components/SEOHead";
import logo from "@/assets/logo.webp";
import { trackLogin } from "@/utils/gtmTracking";
import { useRateLimit, formatTimeRemaining } from "@/hooks/useRateLimit";

// Cloudflare Turnstile site key (visible/public key)
const TURNSTILE_SITE_KEY = "0x4AAAAAACAm_YrVBrm_O96c";

// Login schema (less strict for existing users)
const loginSchema = z.object({
  email: z.string().email({ message: "Email inválido" }),
  password: z.string().min(6, { message: "Senha deve ter no mínimo 6 caracteres" }),
});

type ViewMode = "login" | "signup" | "forgot-password";

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("login");
  const [resetEmail, setResetEmail] = useState("");
  const turnstileRef = useRef<HTMLDivElement>(null);
  const [turnstileToken, setTurnstileToken] = useState<string>("");
  const [turnstileWidgetId, setTurnstileWidgetId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
    phone: "",
  });
  
  // Magic Link State
  const [magicLinkEmail, setMagicLinkEmail] = useState("");
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [showMagicLinkTurnstile, setShowMagicLinkTurnstile] = useState(false);
  const magicLinkTurnstileRef = useRef<HTMLDivElement>(null);
  const [magicLinkTurnstileToken, setMagicLinkTurnstileToken] = useState<string>("");
  const [magicLinkTurnstileWidgetId, setMagicLinkTurnstileWidgetId] = useState<string | null>(null);
  
  // MFA State
  const [showMFAVerify, setShowMFAVerify] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string>("");

  // Rate limiting for login attempts: 5 attempts per 5 minutes, block for 2 minutes
  const loginRateLimit = useRateLimit('auth_login', {
    maxAttempts: 5,
    windowMs: 5 * 60 * 1000, // 5 minutes
    blockDurationMs: 2 * 60 * 1000, // 2 minutes block
  });

  // Rate limiting for signup attempts: 3 attempts per 10 minutes, block for 5 minutes
  const signupRateLimit = useRateLimit('auth_signup', {
    maxAttempts: 3,
    windowMs: 10 * 60 * 1000, // 10 minutes
    blockDurationMs: 5 * 60 * 1000, // 5 minutes block
  });

  // Rate limiting for magic link: 3 attempts per 10 minutes, block for 5 minutes
  const magicLinkRateLimit = useRateLimit('auth_magic_link', {
    maxAttempts: 3,
    windowMs: 10 * 60 * 1000, // 10 minutes
    blockDurationMs: 5 * 60 * 1000, // 5 minutes block
  });

  const plan = searchParams.get("plan");
  const mode = searchParams.get("mode");

  // Set initial view mode based on URL parameter
  useEffect(() => {
    if (mode === "signup") {
      setViewMode("signup");
    }
  }, [mode]);

  useEffect(() => {
    // Check if user is already logged in and redirect based on role
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        // Check if user is admin
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .eq("role", "admin")
          .maybeSingle();
        
        if (roles) {
          navigate("/app/admin");
        } else {
          navigate("/app/dashboard");
        }
      }
    };
    checkAuth();
  }, [navigate]);

  // Load Turnstile script once on mount
  useEffect(() => {
    if (!document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]')) {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  }, []);

  // Render/cleanup Turnstile widget when forgot password form is shown/hidden
  useEffect(() => {
    if (viewMode !== "forgot-password") {
      // Cleanup widget when form is hidden
      if (turnstileWidgetId && (window as any).turnstile) {
        (window as any).turnstile.remove(turnstileWidgetId);
        setTurnstileWidgetId(null);
        setTurnstileToken("");
      }
      return;
    }

    // Wait for script to load and container to be available
    const renderWidget = () => {
      if (turnstileRef.current && (window as any).turnstile && !turnstileWidgetId) {
        try {
          const widgetId = (window as any).turnstile.render(turnstileRef.current, {
            sitekey: TURNSTILE_SITE_KEY,
            callback: (token: string) => setTurnstileToken(token),
            "error-callback": () => setTurnstileToken(""),
            theme: "light",
          });
          setTurnstileWidgetId(widgetId);
        } catch (error) {
          console.error("[Turnstile] Error rendering widget:", error);
        }
      }
    };

    // Check if script is already loaded, otherwise wait
    if ((window as any).turnstile) {
      renderWidget();
    } else {
      const checkInterval = setInterval(() => {
        if ((window as any).turnstile) {
          clearInterval(checkInterval);
          renderWidget();
        }
      }, 100);
      
      // Cleanup interval after 10 seconds
      setTimeout(() => clearInterval(checkInterval), 10000);
    }

    return () => {
      if (turnstileWidgetId && (window as any).turnstile) {
        (window as any).turnstile.remove(turnstileWidgetId);
        setTurnstileWidgetId(null);
        setTurnstileToken("");
      }
    };
  }, [viewMode, turnstileWidgetId]);

  // Render/cleanup Turnstile widget for Magic Link
  useEffect(() => {
    if (!showMagicLinkTurnstile) {
      if (magicLinkTurnstileWidgetId && (window as any).turnstile) {
        (window as any).turnstile.remove(magicLinkTurnstileWidgetId);
        setMagicLinkTurnstileWidgetId(null);
        setMagicLinkTurnstileToken("");
      }
      return;
    }

    const renderWidget = () => {
      if (magicLinkTurnstileRef.current && (window as any).turnstile && !magicLinkTurnstileWidgetId) {
        try {
          const widgetId = (window as any).turnstile.render(magicLinkTurnstileRef.current, {
            sitekey: TURNSTILE_SITE_KEY,
            callback: (token: string) => setMagicLinkTurnstileToken(token),
            "error-callback": () => setMagicLinkTurnstileToken(""),
            theme: "light",
          });
          setMagicLinkTurnstileWidgetId(widgetId);
        } catch (error) {
          console.error("[Turnstile] Error rendering magic link widget:", error);
        }
      }
    };

    if ((window as any).turnstile) {
      renderWidget();
    } else {
      const checkInterval = setInterval(() => {
        if ((window as any).turnstile) {
          clearInterval(checkInterval);
          renderWidget();
        }
      }, 100);
      setTimeout(() => clearInterval(checkInterval), 10000);
    }

    return () => {
      if (magicLinkTurnstileWidgetId && (window as any).turnstile) {
        (window as any).turnstile.remove(magicLinkTurnstileWidgetId);
        setMagicLinkTurnstileWidgetId(null);
        setMagicLinkTurnstileToken("");
      }
    };
  }, [showMagicLinkTurnstile, magicLinkTurnstileWidgetId]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check rate limit before proceeding
    if (!loginRateLimit.checkLimit()) {
      toast({
        title: "Muitas tentativas",
        description: `Aguarde ${formatTimeRemaining(loginRateLimit.state.blockTimeRemaining)} antes de tentar novamente.`,
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);
    loginRateLimit.recordAttempt();

    try {
      const validated = loginSchema.parse(formData);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: validated.email,
        password: validated.password,
      });

      if (error) throw error;

      // Check if MFA is required
      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      const verifiedFactors = factorsData?.totp?.filter(f => f.status === "verified") || [];
      
      if (verifiedFactors.length > 0) {
        // MFA is enabled, show verification screen
        setMfaFactorId(verifiedFactors[0].id);
        setShowMFAVerify(true);
        setLoading(false);
        return;
      }

      // No MFA, proceed with normal login
      completeLogin();
    } catch (error: any) {
      toast({
        title: "Erro ao fazer login",
        description: error.message === "Invalid login credentials" ? "Email ou senha incorretos" : error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const completeLogin = async () => {
    // Reset rate limit on successful login
    loginRateLimit.reset();

    // Track login event
    trackLogin('email');

    toast({
      title: "Login realizado!",
      description: "Bem-vindo de volta.",
    });

    // Check if user is admin to redirect appropriately
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      
      if (roles) {
        navigate("/app/admin");
      } else {
        navigate("/app/dashboard");
      }
    } else {
      navigate("/app/dashboard");
    }
  };

  const handleMFASuccess = () => {
    setShowMFAVerify(false);
    setMfaFactorId("");
    completeLogin();
  };

  const handleMFACancel = async () => {
    setShowMFAVerify(false);
    setMfaFactorId("");
    // Sign out to clear the partial session
    await supabase.auth.signOut();
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!turnstileToken) {
        throw new Error("Por favor, complete a verificação de segurança");
      }

      // Usar edge function customizada para enviar email em português com logo da Valuation
      const { data, error } = await supabase.functions.invoke("send-password-recovery-request", {
        body: { 
          email: resetEmail,
          turnstileToken: turnstileToken,
        }
      });

      if (error) throw error;

      toast({
        title: "Email enviado!",
        description: "Verifique sua caixa de entrada para redefinir sua senha. O email pode levar alguns minutos para chegar.",
      });

      setViewMode("login");
      setResetEmail("");
      setTurnstileToken("");
      
      // Reset Turnstile widget
      if ((window as any).turnstile && turnstileRef.current) {
        (window as any).turnstile.reset();
      }
    } catch (error: any) {
      toast({
        title: "Erro ao enviar email",
        description: error.message,
        variant: "destructive",
      });
      
      // Reset Turnstile on error
      if ((window as any).turnstile && turnstileRef.current) {
        (window as any).turnstile.reset();
      }
      setTurnstileToken("");
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check rate limit
    if (!magicLinkRateLimit.checkLimit()) {
      toast({
        title: "Muitas tentativas",
        description: `Aguarde ${formatTimeRemaining(magicLinkRateLimit.state.blockTimeRemaining)} antes de tentar novamente.`,
        variant: "destructive",
      });
      return;
    }
    
    // If turnstile not shown yet, show it and wait for token
    if (!showMagicLinkTurnstile) {
      setShowMagicLinkTurnstile(true);
      return;
    }

    if (!magicLinkTurnstileToken) {
      toast({
        title: "Verificação pendente",
        description: "Complete a verificação de segurança para continuar.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    magicLinkRateLimit.recordAttempt();

    try {
      const { data, error } = await supabase.functions.invoke("send-magic-link", {
        body: { 
          email: magicLinkEmail,
          turnstileToken: magicLinkTurnstileToken,
        }
      });

      if (error) throw error;

      setMagicLinkSent(true);
      toast({
        title: "Link enviado!",
        description: "Verifique sua caixa de entrada.",
      });

      // Reset turnstile
      setShowMagicLinkTurnstile(false);
      setMagicLinkTurnstileToken("");
    } catch (error: any) {
      toast({
        title: "Erro ao enviar link",
        description: error.message,
        variant: "destructive",
      });
      
      // Reset Turnstile on error
      if ((window as any).turnstile && magicLinkTurnstileRef.current) {
        (window as any).turnstile.reset();
      }
      setMagicLinkTurnstileToken("");
    } finally {
      setLoading(false);
    }
  };

  // Show MFA verification screen
  if (showMFAVerify) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/30 p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link to="/" className="inline-block mb-4 hover:opacity-80 transition-opacity">
              <img src={logo} alt="VALUATION Invest tech" className="h-16 w-auto mx-auto" />
            </Link>
          </div>
          <TwoFactorVerify 
            factorId={mfaFactorId}
            onSuccess={handleMFASuccess}
            onCancel={handleMFACancel}
          />
        </div>
      </div>
    );
  }

  // Forgot Password View
  if (viewMode === "forgot-password") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/30 p-4">
        <SEOHead
          title="Recuperar Senha - VALUATION"
          description="Recupere sua senha da VALUATION Invest Tech."
          canonical="https://valuationit.com.br/auth"
          noindex={true}
        />
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link to="/" className="inline-block mb-4 hover:opacity-80 transition-opacity">
              <img src={logo} alt="VALUATION Invest tech" className="h-16 w-auto mx-auto" />
            </Link>
          </div>

          <Card className="shadow-elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <button
                  onClick={() => setViewMode("login")}
                  className="p-1 hover:bg-muted rounded-md transition-colors"
                >
                  <ArrowLeft size={20} />
                </button>
                Recuperar Senha
              </CardTitle>
              <CardDescription>
                Digite seu email para receber um link de recuperação
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                  />
                </div>
                
                {/* Cloudflare Turnstile CAPTCHA */}
                <div className="space-y-2">
                  <Label>Verificação de Segurança</Label>
                  <div 
                    ref={turnstileRef}
                    id="turnstile-container-auth"
                  />
                  {!turnstileToken && (
                    <p className="text-sm text-muted-foreground">
                      Complete a verificação acima para continuar
                    </p>
                  )}
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={loading || !turnstileToken}
                >
                  {loading ? "Enviando..." : "Enviar Link"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Signup View
  if (viewMode === "signup") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/30 p-4">
        <SEOHead
          title="Criar Conta - VALUATION"
          description="Crie sua conta na VALUATION Invest Tech. Acesse análises profissionais de investimentos."
          canonical="https://valuationit.com.br/auth"
          noindex={true}
        />
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link to="/" className="inline-block mb-4 hover:opacity-80 transition-opacity">
              <img src={logo} alt="VALUATION Invest tech" className="h-16 w-auto mx-auto" />
            </Link>
            <p className="text-muted-foreground mt-2">Crie sua conta</p>
          </div>

          <SignupForm plan={plan || undefined} />

          <div className="mt-6 text-center">
            <span className="text-muted-foreground text-sm">Já tem conta? </span>
            <button
              onClick={() => setViewMode("login")}
              className="text-sm text-primary hover:underline font-medium"
            >
              Entrar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main Login View (default)
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/30 p-4">
      <SEOHead
        title="Login - Acesse sua Conta"
        description="Faça login na VALUATION Invest Tech. Acesse análises profissionais de investimentos e carteiras personalizadas."
        canonical="https://valuationit.com.br/auth"
        noindex={true}
      />
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-block mb-4 hover:opacity-80 transition-opacity">
            <img src={logo} alt="VALUATION Invest tech" className="h-16 w-auto mx-auto" />
          </Link>
          <p className="text-muted-foreground mt-2">Entre na sua conta</p>
        </div>

        <Card className="shadow-elevated">
          <CardHeader>
            <CardTitle>Entrar</CardTitle>
            <CardDescription>
              Acesse sua conta com email e senha
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Email/Password Login Form */}
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signin-email">Email</Label>
                <Input
                  id="signin-email"
                  type="email"
                  placeholder="seu@email.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signin-password">Senha</Label>
                <div className="relative">
                  <Input
                    id="signin-password"
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
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setViewMode("forgot-password")}
                  className="text-sm text-primary hover:underline"
                >
                  Esqueci minha senha
                </button>
              </div>
              {loginRateLimit.state.isBlocked && (
                <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                  <Clock size={16} />
                  <span>Bloqueado por {formatTimeRemaining(loginRateLimit.state.blockTimeRemaining)}</span>
                </div>
              )}
              <Button type="submit" className="w-full" disabled={loading || loginRateLimit.state.isBlocked}>
                {loading ? "Entrando..." : loginRateLimit.state.isBlocked ? "Aguarde..." : "Entrar"}
              </Button>
            </form>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                  ou entre sem senha
                </span>
              </div>
            </div>

            {/* Magic Link Section */}
            <div className="bg-muted/30 rounded-lg p-4 space-y-4">
              {magicLinkSent ? (
                <div className="space-y-4 text-center py-2">
                  <div className="w-14 h-14 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle className="w-7 h-7 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-semibold">Link enviado!</h3>
                    <p className="text-muted-foreground text-sm">
                      Enviamos um link para <strong>{magicLinkEmail}</strong>
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setMagicLinkSent(false);
                      setMagicLinkEmail("");
                    }}
                  >
                    Enviar para outro email
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleMagicLink} className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Wand2 size={16} className="text-primary" />
                    <span>Login com Magic Link</span>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    Enviaremos um link para seu email. Clique nele para entrar.
                  </p>
                  
                  <div className="space-y-2">
                    <Input
                      id="magic-link-email"
                      type="email"
                      placeholder="seu@email.com"
                      value={magicLinkEmail}
                      onChange={(e) => setMagicLinkEmail(e.target.value)}
                      required
                    />
                  </div>
                  
                  {showMagicLinkTurnstile && (
                    <div className="space-y-2">
                      <Label className="text-sm">Verificação de Segurança</Label>
                      <div 
                        ref={magicLinkTurnstileRef}
                        id="turnstile-container-magic-link"
                      />
                      {!magicLinkTurnstileToken && (
                        <p className="text-xs text-muted-foreground">
                          Complete a verificação acima
                        </p>
                      )}
                    </div>
                  )}
                  
                  {magicLinkRateLimit.state.isBlocked && (
                    <div className="flex items-center gap-2 p-2 rounded-md bg-destructive/10 text-destructive text-sm">
                      <Clock size={14} />
                      <span>Bloqueado por {formatTimeRemaining(magicLinkRateLimit.state.blockTimeRemaining)}</span>
                    </div>
                  )}
                  
                  <Button 
                    type="submit" 
                    variant="outline"
                    className="w-full gap-2" 
                    disabled={loading || magicLinkRateLimit.state.isBlocked || (showMagicLinkTurnstile && !magicLinkTurnstileToken)}
                  >
                    <Mail size={16} />
                    {loading ? "Enviando..." : showMagicLinkTurnstile && !magicLinkTurnstileToken ? "Complete a verificação" : "Enviar Link Mágico"}
                  </Button>
                </form>
              )}
            </div>

            {/* Signup Link */}
            <div className="text-center pt-2">
              <span className="text-muted-foreground text-sm">Não tem conta? </span>
              <button
                onClick={() => setViewMode("signup")}
                className="text-sm text-primary hover:underline font-medium"
              >
                Criar Conta
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
