import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MessageSquare, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ContactSpecialistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assetCode?: string;
  assetName?: string;
  planName?: string;
}

/**
 * Canal de contato para "Falar com Especialista" (usado pelo CTA do plano
 * WEALTH em /assinatura e pelo card de ativos que exigem análise
 * personalizada). Lê o número de WhatsApp comercial configurável pelo admin
 * em app_config (chave "sales_whatsapp_number" — mesmo padrão já usado para
 * "community_whatsapp_link" em src/pages/app/Admin.tsx). Nenhum número é
 * inventado: se o admin ainda não configurou um número, o botão direciona
 * para o formulário de contato existente (/contato, com captura de lead via
 * capture-lead) em vez de abrir um link wa.me sem destino.
 */
const ContactSpecialistDialog = ({ open, onOpenChange, assetCode, assetName, planName }: ContactSpecialistDialogProps) => {
  const navigate = useNavigate();
  const [contactMessage] = useState(() =>
    planName
      ? `Olá, gostaria de falar com um especialista sobre o plano ${planName}`
      : `Olá, gostaria de falar com um especialista sobre o ativo ${assetCode} - ${assetName}`
  );

  const { data: whatsappNumber, isLoading } = useQuery({
    queryKey: ["sales-whatsapp-number"],
    queryFn: async () => {
      // app_config em geral é admin-only (RLS, desde a correção de PII de
      // 2026-03-08) — este número comercial é lido via RPC pública dedicada
      // e restrita a essa única chave, não pela tabela inteira.
      const { data, error } = await supabase.rpc("get_sales_whatsapp_number");
      if (error) return null;
      return (data as string | null)?.trim() || null;
    },
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const handleContact = () => {
    if (whatsappNumber) {
      const digitsOnly = whatsappNumber.replace(/\D/g, "");
      const whatsappUrl = `https://wa.me/${digitsOnly}?text=${encodeURIComponent(contactMessage)}`;
      window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    } else {
      // Sem número comercial configurado: usa o formulário de contato
      // existente em vez de um link WhatsApp sem destino.
      navigate(`/contato?assunto=${encodeURIComponent(planName ? `Plano ${planName}` : `Ativo ${assetCode}`)}`);
    }
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
              ? "Este plano é personalizado de acordo com suas necessidades. Clique no botão abaixo para entrar em contato com nosso time de especialistas."
              : "Este ativo requer análise personalizada. Clique no botão abaixo para entrar em contato com nosso time de especialistas."}
          </p>

          <Button
            onClick={handleContact}
            disabled={isLoading}
            className="w-full gap-2"
            size="lg"
          >
            {whatsappNumber ? (
              <>
                <MessageSquare className="h-5 w-5" />
                Abrir WhatsApp
              </>
            ) : (
              <>
                <Mail className="h-5 w-5" />
                Ir para o formulário de contato
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ContactSpecialistDialog;
