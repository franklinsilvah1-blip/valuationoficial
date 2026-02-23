import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

interface InvestorProfileBannerProps {
  onStartQuestionnaire: () => void;
  isReclassification?: boolean;
}

const InvestorProfileBanner = ({ 
  onStartQuestionnaire, 
  isReclassification = false 
}: InvestorProfileBannerProps) => {
  return (
    <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
      <AlertCircle className="h-5 w-5 text-amber-600" />
      <AlertDescription className="flex items-center justify-between gap-4">
        <span className="text-amber-900 dark:text-amber-200">
          {isReclassification 
            ? "🔄 Está na hora de atualizar seu perfil de investidor. Responda novamente o questionário para otimizar sua experiência."
            : "⚠️ Para usar a plataforma de forma completa, responda o questionário de perfil de investidor."
          }
        </span>
        <Button 
          onClick={onStartQuestionnaire}
          variant="default"
          size="sm"
          className="whitespace-nowrap"
        >
          {isReclassification ? "Atualizar agora" : "Responder agora"}
        </Button>
      </AlertDescription>
    </Alert>
  );
};

export default InvestorProfileBanner;
