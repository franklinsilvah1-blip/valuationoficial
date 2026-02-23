import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";

interface ContactSpecialistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assetCode?: string;
  assetName?: string;
  planName?: string;
}

const ContactSpecialistDialog = ({ open, onOpenChange, assetCode, assetName, planName }: ContactSpecialistDialogProps) => {
  const handleWhatsAppContact = () => {
    const message = planName
      ? encodeURIComponent(`Olá, gostaria de falar com um especialista sobre o plano ${planName}`)
      : encodeURIComponent(`Olá, gostaria de falar com um especialista sobre o ativo ${assetCode} - ${assetName}`);
    
    const whatsappUrl = `https://wa.me/?text=${message}`;
    window.open(whatsappUrl, "_blank");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Falar com Especialista</DialogTitle>
          <DialogDescription>
            {planName ? (
              <>Você está interessado no <strong>plano {planName}</strong></>
            ) : (
              <>Você está interessado no ativo <strong>{assetCode}</strong> - {assetName}</>
            )}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            {planName 
              ? "Este plano é personalizado de acordo com suas necessidades. Clique no botão abaixo para entrar em contato via WhatsApp com nosso time de especialistas."
              : "Este ativo requer análise personalizada. Clique no botão abaixo para entrar em contato via WhatsApp com nosso time de especialistas."}
          </p>
          
          <Button 
            onClick={handleWhatsAppContact}
            className="w-full gap-2"
            size="lg"
          >
            <MessageSquare className="h-5 w-5" />
            Abrir WhatsApp
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ContactSpecialistDialog;
