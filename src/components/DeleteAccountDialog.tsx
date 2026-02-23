import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface DeleteAccountDialogProps {
  trigger?: React.ReactNode;
}

const DeleteAccountDialog = ({ trigger }: DeleteAccountDialogProps) => {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [understood, setUnderstood] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleDelete = async () => {
    if (confirmation !== "DELETAR") {
      toast({
        variant: "destructive",
        title: "Confirmação inválida",
        description: "Digite exatamente 'DELETAR' para confirmar.",
      });
      return;
    }

    if (!understood) {
      toast({
        variant: "destructive",
        title: "Confirmação necessária",
        description: "Você precisa confirmar que entende que esta ação é irreversível.",
      });
      return;
    }

    setIsDeleting(true);

    try {
      const { data, error } = await supabase.functions.invoke("delete-own-account", {
        body: { confirmation },
      });

      if (error) throw error;

      toast({
        title: "Conta deletada",
        description: "Sua conta e todos os dados foram removidos com sucesso.",
      });

      // Logout and redirect
      await supabase.auth.signOut();
      navigate("/");
    } catch (error: any) {
      console.error("Error deleting account:", error);
      toast({
        variant: "destructive",
        title: "Erro ao deletar conta",
        description: error.message || "Tente novamente mais tarde.",
      });
    } finally {
      setIsDeleting(false);
      setOpen(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        {trigger || (
          <Button variant="destructive" size="lg">
            Deletar Conta
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-6 w-6" />
            Deletar Conta Permanentemente
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-4 text-left">
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 space-y-2">
              <p className="font-semibold text-destructive">⚠️ ATENÇÃO: Esta ação é IRREVERSÍVEL!</p>
              <p className="text-sm">Ao deletar sua conta, você perderá:</p>
              <ul className="list-disc list-inside text-sm space-y-1 ml-2">
                <li>Todos os seus dados pessoais</li>
                <li>Seu perfil de investidor</li>
                <li>Suas análises e favoritos</li>
                <li>Seu histórico de visualizações</li>
                <li>Sua assinatura ativa (será cancelada automaticamente)</li>
              </ul>
            </div>

            <div className="bg-muted rounded-lg p-4 space-y-2">
              <p className="font-semibold text-sm">📋 Direitos LGPD</p>
              <p className="text-sm">
                Conforme a Lei Geral de Proteção de Dados (LGPD), você tem o direito de solicitar
                a exclusão de todos os seus dados pessoais. Esta ação está de acordo com o Art. 18
                da LGPD.
              </p>
            </div>

            <div className="space-y-4 mt-6">
              <div className="flex items-start space-x-2">
                <Checkbox
                  id="understood"
                  checked={understood}
                  onCheckedChange={(checked) => setUnderstood(checked as boolean)}
                />
                <Label
                  htmlFor="understood"
                  className="text-sm font-normal leading-tight cursor-pointer"
                >
                  Eu entendo que esta ação é irreversível e que todos os meus dados serão
                  permanentemente deletados.
                </Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmation">
                  Digite <strong>DELETAR</strong> para confirmar:
                </Label>
                <Input
                  id="confirmation"
                  placeholder="Digite DELETAR"
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value.toUpperCase())}
                  disabled={isDeleting}
                />
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
            disabled={isDeleting || confirmation !== "DELETAR" || !understood}
            className="bg-destructive hover:bg-destructive/90"
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deletando...
              </>
            ) : (
              "Deletar Minha Conta"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteAccountDialog;
