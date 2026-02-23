import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Loader2, AlertTriangle } from "lucide-react";

interface CancellationSurveyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string, details?: string) => void;
  loading?: boolean;
}

const CANCELLATION_REASONS = [
  { id: "price", label: "Preço muito alto" },
  { id: "not_using", label: "Não estou usando o suficiente" },
  { id: "missing_features", label: "Faltam funcionalidades que preciso" },
  { id: "found_alternative", label: "Encontrei uma alternativa melhor" },
  { id: "temporary", label: "Pausa temporária nos investimentos" },
  { id: "difficult", label: "Difícil de usar ou entender" },
  { id: "other", label: "Outro motivo" },
];

export function CancellationSurveyDialog({
  open,
  onOpenChange,
  onConfirm,
  loading = false,
}: CancellationSurveyDialogProps) {
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [details, setDetails] = useState("");

  const handleConfirm = () => {
    if (selectedReason) {
      const reasonLabel = CANCELLATION_REASONS.find(r => r.id === selectedReason)?.label || selectedReason;
      onConfirm(reasonLabel, details.trim() || undefined);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSelectedReason("");
      setDetails("");
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Cancelar Assinatura
          </DialogTitle>
          <DialogDescription>
            Antes de continuar, gostaríamos de entender o motivo do cancelamento para melhorar nosso serviço.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <RadioGroup value={selectedReason} onValueChange={setSelectedReason}>
            {CANCELLATION_REASONS.map((reason) => (
              <div key={reason.id} className="flex items-center space-x-3">
                <RadioGroupItem value={reason.id} id={reason.id} />
                <Label htmlFor={reason.id} className="cursor-pointer text-sm">
                  {reason.label}
                </Label>
              </div>
            ))}
          </RadioGroup>

          {selectedReason && (
            <div className="space-y-2">
              <Label htmlFor="details" className="text-sm text-muted-foreground">
                Gostaria de compartilhar mais detalhes? (opcional)
              </Label>
              <Textarea
                id="details"
                placeholder="Conte-nos mais sobre sua experiência..."
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                className="resize-none"
                rows={3}
              />
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={loading}
          >
            Voltar
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!selectedReason || loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : (
              "Continuar para Cancelamento"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
