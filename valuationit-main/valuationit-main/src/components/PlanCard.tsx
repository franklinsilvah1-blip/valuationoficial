import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { trackSubscriptionClick } from "@/utils/gtmTracking";

interface PlanCardProps {
  name: string;
  description: string;
  price: string;
  period: string;
  features: string[];
  highlighted?: boolean;
  comingSoon?: boolean;
  consultOnly?: boolean;
  billingNote?: string;
  isCurrentPlan?: boolean;
  onSubscribe?: () => void;
  loading?: boolean;
}

const PlanCard = ({ 
  name, 
  description, 
  price, 
  period, 
  features, 
  highlighted = false, 
  comingSoon = false, 
  consultOnly = false,
  billingNote,
  isCurrentPlan = false,
  onSubscribe, 
  loading = false 
}: PlanCardProps) => {
  return (
    <Card
      className={`relative shadow-card hover:shadow-elevated transition-all duration-300 ${
        highlighted ? "border-primary shadow-glow scale-105" : ""
      } ${comingSoon ? "opacity-60" : ""}`}
    >
      {highlighted && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
          <div className="gradient-cta text-accent-foreground px-4 py-1 rounded-full text-xs font-bold shadow-lg whitespace-nowrap">
            MAIS POPULAR
          </div>
        </div>
      )}

      {comingSoon && (
        <div className="absolute -top-4 right-4">
          <div className="bg-muted text-muted-foreground px-4 py-1 rounded-full text-xs font-bold shadow-lg">
            EM BREVE
          </div>
        </div>
      )}

      <CardHeader className="text-center pb-6">
        <CardTitle className="text-2xl font-bold">{name}</CardTitle>
        <CardDescription className="text-sm">{description}</CardDescription>
        <div className="mt-4">
          <span 
            className={`${name === "GRÁTIS" ? "text-[2rem] leading-[2rem]" : "text-4xl"} font-bold text-primary`}
          >
            {price}
          </span>
          {period && <span className="text-muted-foreground">/{period}</span>}
        </div>
        {billingNote && (
          <p className="text-xs text-muted-foreground mt-2">{billingNote}</p>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        <ul className="space-y-3">
          {features.map((feature, index) => (
            <li key={index} className="flex items-start gap-2">
              <Check className="h-5 w-5 text-secondary shrink-0 mt-0.5" />
              <span className="text-sm">{feature}</span>
            </li>
          ))}
        </ul>

        {comingSoon ? (
          <Button disabled className="w-full" size="lg">
            Em Breve
          </Button>
        ) : isCurrentPlan ? (
          <Button disabled className="w-full" size="lg" variant="outline">
            Plano Atual
          </Button>
        ) : (
          <Button
            onClick={() => {
              trackSubscriptionClick(name, price, 'plan_card');
              onSubscribe?.();
            }}
            disabled={loading}
            className={`w-full ${
              highlighted ? "gradient-cta text-accent-foreground font-semibold hover:opacity-90" : ""
            }`}
            size="lg"
          >
            {loading 
              ? "Processando..." 
              : name === "WEALTH"
              ? "Falar com Especialista" 
              : name === "FREE"
              ? "Experimente grátis!"
              : "Assinar"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default PlanCard;
