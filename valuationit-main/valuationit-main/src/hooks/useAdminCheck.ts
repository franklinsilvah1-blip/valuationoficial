import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

/**
 * Hook para verificar permissões de administrador
 * Redireciona para dashboard se o usuário não for admin
 */
export const useAdminCheck = () => {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!loading && !isAdmin) {
      toast({
        title: "Acesso Negado",
        description: "Você não tem permissão para acessar esta área.",
        variant: "destructive",
      });
      navigate("/app/dashboard", { replace: true });
    }
  }, [isAdmin, loading, navigate, toast]);

  return { isAdmin, loading };
};
