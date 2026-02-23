import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface PasswordRequirement {
  label: string;
  test: (password: string) => boolean;
}

const passwordRequirements: PasswordRequirement[] = [
  { label: "Mínimo 8 caracteres", test: (p) => p.length >= 8 },
  { label: "Letra maiúscula", test: (p) => /[A-Z]/.test(p) },
  { label: "Letra minúscula", test: (p) => /[a-z]/.test(p) },
  { label: "Número", test: (p) => /[0-9]/.test(p) },
  { label: "Símbolo (!@#$%^&*)", test: (p) => /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/`~;']/.test(p) },
];

export const validatePasswordStrength = (password: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (password.length < 8) errors.push("Mínimo 8 caracteres");
  if (!/[A-Z]/.test(password)) errors.push("Letra maiúscula obrigatória");
  if (!/[a-z]/.test(password)) errors.push("Letra minúscula obrigatória");
  if (!/[0-9]/.test(password)) errors.push("Número obrigatório");
  if (!/[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/`~;']/.test(password)) errors.push("Símbolo obrigatório");
  
  return { isValid: errors.length === 0, errors };
};

export const getPasswordStrength = (password: string): number => {
  if (!password) return 0;
  return passwordRequirements.filter((req) => req.test(password)).length;
};

interface PasswordStrengthIndicatorProps {
  password: string;
  showRequirements?: boolean;
}

export const PasswordStrengthIndicator = ({ 
  password, 
  showRequirements = true 
}: PasswordStrengthIndicatorProps) => {
  const strength = getPasswordStrength(password);
  const percentage = (strength / passwordRequirements.length) * 100;

  const getStrengthColor = () => {
    if (strength <= 1) return "bg-destructive";
    if (strength <= 2) return "bg-orange-500";
    if (strength <= 3) return "bg-yellow-500";
    if (strength <= 4) return "bg-lime-500";
    return "bg-green-500";
  };

  const getStrengthLabel = () => {
    if (strength <= 1) return "Muito fraca";
    if (strength <= 2) return "Fraca";
    if (strength <= 3) return "Razoável";
    if (strength <= 4) return "Boa";
    return "Forte";
  };

  if (!password) return null;

  return (
    <div className="space-y-3 mt-2">
      {/* Strength bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Força da senha:</span>
          <span className={cn(
            "font-medium",
            strength <= 2 ? "text-destructive" : 
            strength <= 3 ? "text-yellow-600" : 
            "text-green-600"
          )}>
            {getStrengthLabel()}
          </span>
        </div>
        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
          <div 
            className={cn("h-full transition-all duration-300", getStrengthColor())}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* Requirements checklist */}
      {showRequirements && (
        <div className="grid grid-cols-1 gap-1">
          {passwordRequirements.map((req, index) => {
            const isValid = req.test(password);
            return (
              <div 
                key={index}
                className={cn(
                  "flex items-center gap-2 text-xs transition-colors",
                  isValid ? "text-green-600" : "text-muted-foreground"
                )}
              >
                {isValid ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <X className="h-3.5 w-3.5" />
                )}
                <span>{req.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
