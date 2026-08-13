import { useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Clock } from "lucide-react";
import { z } from "zod";
import { PasswordStrengthIndicator, validatePasswordStrength } from "@/components/PasswordStrengthIndicator";
import { trackSignup } from "@/utils/gtmTracking";
import { getStoredAffiliateCode, clearAffiliateTracking } from "@/hooks/useAffiliateTracking";
import { useRateLimit, formatTimeRemaining } from "@/hooks/useRateLimit";
import { cn } from "@/lib/utils";

// Password validation with strong requirements
const passwordSchema = z.string()
  .min(8, { message: "Senha deve ter no mínimo 8 caracteres" })
  .regex(/[A-Z]/, { message: "Senha deve conter letra maiúscula" })
  .regex(/[a-z]/, { message: "Senha deve conter letra minúscula" })
  .regex(/[0-9]/, { message: "Senha deve conter número" })
  .regex(/[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/`~;']/, { message: "Senha deve conter símbolo especial" });

const signupSchema = z.object({
  email: z.string().email({ message: "Email inválido" }),
  password: passwordSchema,
  name: z.string().min(2, { message: "Nome deve ter no mínimo 2 caracteres" }),
  phone: z.string().min(10, { message: "Telefone inválido" }).optional(),
});

// Register affiliate referral after signup
const registerAffiliateReferral = async (userId: string): Promise<void> => {
  const affiliateCode = getStoredAffiliateCode();
  if (!affiliateCode) return;

  try {
    const { data: affiliate, error: affiliateError } = await supabase
      .from("affiliates")
      .select("id, status")
      .eq("affiliate_code", affiliateCode.toUpperCase())
      .maybeSingle();

    if (affiliateError || !affiliate || affiliate.status !== "active") {
      clearAffiliateTracking();
      return;
    }

    const { error: referralError } = await supabase
      .from("referrals")
      .insert({
        affiliate_id: affiliate.id,
        referred_user_id: userId,
        status: "registered",
      });

    if (!referralError) {
      clearAffiliateTracking();
    }
  } catch (error) {
    console.error("[Affiliate] Error registering referral:", error);
  }
};

const formatPhone = (value: string) => {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length <= 10) {
    return numbers
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  } else {
    return numbers
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .slice(0, 15);
  }
};

interface SignupFormProps {
  plan?: string;
  onSuccess?: () => void;
  className?: string;
  buttonText?: string;
  buttonClassName?: string;
  showCard?: boolean;
}

const SignupForm = ({
  plan,
  onSuccess,
  className,
  buttonText = "Criar Conta",
  buttonClassName,
  showCard = true,
}: SignupFormProps) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
    phone: "",
  });

  const signupRateLimit = useRateLimit('auth_signup', {
    maxAttempts: 3,
    windowMs: 10 * 60 * 1000,
    blockDurationMs: 5 * 60 * 1000,
  });

  const effectivePlan = plan || searchParams.get("plan");

  const handleSignUp = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!signupRateLimit.checkLimit()) {
      toast({
        title: "Muitas tentativas",
        description: `Aguarde ${formatTimeRemaining(signupRateLimit.state.blockTimeRemaining)} antes de tentar novamente.`,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    signupRateLimit.recordAttempt();

    try {
      const passwordValidation = validatePasswordStrength(formData.password);
      if (!passwordValidation.isValid) {
        toast({
          title: "Senha não atende aos requisitos",
          description: passwordValidation.errors[0],
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const validated = signupSchema.parse(formData);

      const { error, data } = await supabase.auth.signUp({
        email: validated.email,
        password: validated.password,
        options: {
          data: { name: validated.name },
          emailRedirectTo: `${window.location.origin}/app/dashboard`,
        },
      });

      if (error) throw error;

      // Update profile with phone after signup
      if (data.user && formData.phone) {
        await supabase
          .from("profiles")
          .update({ phone: formData.phone })
          .eq("id", data.user.id);
      }

      // Register affiliate referral (non-blocking)
      if (data.user) {
        registerAffiliateReferral(data.user.id);
      }

      // Track signup events
      trackSignup('email');

      // Track CompleteRegistration event (Meta Pixel)
      if (typeof window !== 'undefined' && (window as any).fbq) {
        (window as any).fbq('track', 'CompleteRegistration', {
          content_name: effectivePlan || 'START',
          content_category: 'Account'
        });
      }

      // GTM lead event
      if (typeof window !== 'undefined' && (window as any).dataLayer) {
        (window as any).dataLayer.push({
          event: 'generate_lead',
          lead_source: searchParams.get('utm_source') || 'direct',
        });
      }

      // Build thank-you URL preserving UTM params
      const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
      const utmParams = new URLSearchParams();
      utmKeys.forEach(key => {
        const val = searchParams.get(key);
        if (val) utmParams.set(key, val);
      });
      utmParams.set('plan', effectivePlan || 'START');
      const thankYouUrl = `/cadastro/obrigado?${utmParams.toString()}`;

      // If custom onSuccess callback, use it
      if (onSuccess) {
        toast({
          title: "Conta criada com sucesso!",
          description: "Redirecionando...",
        });
        setTimeout(() => onSuccess(), 1500);
        return;
      }

      toast({
        title: "Conta criada com sucesso!",
        description: "Redirecionando...",
      });

      if (effectivePlan && effectivePlan !== "FREE" && effectivePlan !== "START") {
        // Paid plan: redirect to checkout after brief thank-you
        setTimeout(async () => {
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Sessão não encontrada");

            const { data, error } = await supabase.functions.invoke("create-checkout", {
              body: { plan: effectivePlan },
            });

            if (error) throw error;
            if (data?.url) {
              window.location.href = data.url;
            }
          } catch (checkoutError: any) {
            toast({
              title: "Erro ao criar checkout",
              description: checkoutError.message,
              variant: "destructive",
            });
            navigate("/assinatura");
          }
        }, 1500);
      } else {
        // FREE plan: redirect to thank-you page
        setTimeout(() => navigate(thankYouUrl), 1500);
      }
    } catch (error: any) {
      toast({
        title: "Erro ao criar conta",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [formData, signupRateLimit, effectivePlan, onSuccess, navigate, toast, searchParams]);

  const formContent = (
    <form onSubmit={handleSignUp} className={cn("space-y-4", className)}>
      <div className="space-y-2">
        <Label htmlFor="signup-name">Nome</Label>
        <Input
          id="signup-name"
          type="text"
          placeholder="Seu nome"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-phone">Telefone</Label>
        <Input
          id="signup-phone"
          type="tel"
          placeholder="(00) 00000-0000"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: formatPhone(e.target.value) })}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-email">Email</Label>
        <Input
          id="signup-email"
          type="email"
          placeholder="seu@email.com"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-password">Senha</Label>
        <div className="relative">
          <Input
            id="signup-password"
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
        <PasswordStrengthIndicator password={formData.password} />
      </div>

      {signupRateLimit.state.isBlocked && (
        <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
          <Clock size={16} />
          <span>Bloqueado por {formatTimeRemaining(signupRateLimit.state.blockTimeRemaining)}</span>
        </div>
      )}

      <Button
        type="submit"
        className={cn("w-full", buttonClassName)}
        disabled={loading || signupRateLimit.state.isBlocked}
      >
        {loading ? "Criando conta..." : buttonText}
      </Button>
    </form>
  );

  if (!showCard) return formContent;

  return (
    <Card className="shadow-elevated">
      <CardHeader>
        <CardTitle>Criar Conta</CardTitle>
        <CardDescription>Preencha os dados abaixo para começar</CardDescription>
      </CardHeader>
      <CardContent>{formContent}</CardContent>
    </Card>
  );
};

export default SignupForm;
