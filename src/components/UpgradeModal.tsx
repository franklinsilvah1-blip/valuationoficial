import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Check, Crown, Zap } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { normalizePlanCode, isHigherPlan, hasFullMarketAccess } from "@/utils/planHelpers";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetPlan?: "PRO" | "SPECIALIST";
}

const UpgradeModal = ({ open, onOpenChange, targetPlan }: UpgradeModalProps) => {
  const navigate = useNavigate();
  const { userPlan } = useAuth();

  // Determinar título e benefícios baseado no plano alvo
  const getModalContent = () => {
    if (targetPlan === "PRO") {
      return {
        icon: <Crown className="h-10 w-10 text-primary" />,
        title: "Upgrade para Plano PRO",
        description: "Desbloqueie análises PRO e tenha acesso a muito mais oportunidades de investimento.",
        benefits: [
          "Acesso a todas as análises do Plano START",
          "Acesso a análises exclusivas do Plano PRO",
          "Recomendações de compra e venda",
          "Indicadores avançados (ROI 25, DY 25/24)",
          "Suporte prioritário",
          "Atualizações em tempo real",
        ],
      };
    }

    if (targetPlan === "SPECIALIST") {
      return {
        icon: <Zap className="h-10 w-10 text-primary" />,
        title: "Upgrade para SPECIALIST",
        description: "Tenha acesso às análises mais completas e exclusivas do mercado.",
        benefits: [
          "Acesso total: START + PRO + SPECIALIST",
          "Análises de especialistas certificados",
          "Nota de especialista para cada ativo",
          "Carteiras personalizadas",
          "Consultoria individualizada",
          "Acesso antecipado a novos ativos",
          "Suporte VIP 24/7",
        ],
      };
    }

    // Fallback para usuários sem acesso completo (plano START, modal genérico)
    return {
      icon: <Crown className="h-10 w-10 text-primary" />,
      title: "Recurso Bloqueado",
      description: "Este recurso é exclusivo para assinantes. Faça upgrade para ter acesso ilimitado!",
      benefits: [
        "Visualizações ilimitadas de ativos",
        "Acesso a análises completas",
        "Recomendações de compra e venda",
        "Tendências e indicadores avançados",
        "Acesso à comunidade exclusiva",
        "Suporte prioritário",
      ],
    };
  };

  const content = getModalContent();

  // Se tem targetPlan e o usuário já tem esse plano ou superior, não mostrar
  const normalizedUserPlan = normalizePlanCode(userPlan);
  if (targetPlan) {
    if (normalizedUserPlan === targetPlan || isHigherPlan(normalizedUserPlan, targetPlan)) {
      return null;
    }
  } else if (hasFullMarketAccess(userPlan)) {
    // Só mostrar o modal genérico para quem não tem acesso completo (START)
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex justify-center mb-2">
            {content.icon}
          </div>
          <DialogTitle className="text-center text-xl">{content.title}</DialogTitle>
          <DialogDescription className="text-center pt-2">
            {content.description}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <p className="text-sm font-semibold">
              {targetPlan ? `Benefícios do plano ${targetPlan}:` : "Com um plano pago você terá:"}
            </p>
            <ul className="space-y-2">
              {content.benefits.map((benefit, index) => (
                <li key={index} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-secondary flex-shrink-0" />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <Button
          onClick={() => {
            onOpenChange(false);
            navigate("/assinatura");
          }}
          className="w-full gradient-cta font-semibold"
        >
          {targetPlan ? `Ver Plano ${targetPlan}` : "Ver Planos"}
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default UpgradeModal;
