import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

/**
 * "Carteira TRIM": montagem automática da carteira do próprio usuário a partir
 * do campo CARTEIRA TRIM dos ativos, sem intermediação de um especialista
 * ValuAtion (benefício do plano PRO).
 *
 * NÃO cria estrutura nova. A carteira do usuário já existe e já é
 * `asset_favorites` (relação usuário × ativo) — é ela que alimenta
 * /app/carteira, o simulador (useWalletSimulator) e o contador do AppNavbar.
 * Este hook apenas expõe leitura/escrita dessa mesma tabela a partir da tela
 * de Mercado, e invalida exatamente as mesmas query keys que
 * AssetCard/Dashboard já invalidam, para que todas as telas continuem em
 * sincronia. Nenhuma migration foi necessária para esta funcionalidade.
 */
export const useCarteiraTrim = (enabled: boolean = true) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: selectedIds = new Set<string>(), isLoading } = useQuery({
    queryKey: ["carteira-trim-ids"],
    enabled,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<Set<string>> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return new Set<string>();

      const { data, error } = await supabase
        .from("asset_favorites")
        .select("asset_id")
        .eq("user_id", user.id);

      if (error) throw error;
      return new Set((data ?? []).map((row: any) => row.asset_id).filter(Boolean));
    },
  });

  const invalidate = () => {
    // Mesmas chaves já usadas por AssetCard.tsx e Dashboard.tsx — manter a
    // lista idêntica evita que a carteira apareça desatualizada em uma tela
    // depois de ser alterada em outra.
    queryClient.invalidateQueries({ queryKey: ["carteira-trim-ids"] });
    queryClient.invalidateQueries({ queryKey: ["favorites"] });
    queryClient.invalidateQueries({ queryKey: ["favorites-count"] });
    queryClient.invalidateQueries({ queryKey: ["favorites-for-wallet"] });
  };

  const toggle = useMutation({
    mutationFn: async ({ assetId, codigo }: { assetId: string; codigo?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Faça login para montar sua carteira.");

      const isSelected = selectedIds.has(assetId);

      if (isSelected) {
        const { error } = await supabase
          .from("asset_favorites")
          .delete()
          .eq("user_id", user.id)
          .eq("asset_id", assetId);
        if (error) throw error;
        return { added: false, codigo };
      }

      const { error } = await supabase
        .from("asset_favorites")
        .insert({ user_id: user.id, asset_id: assetId });
      if (error) throw error;
      return { added: true, codigo };
    },
    onSuccess: ({ added, codigo }) => {
      invalidate();
      toast({
        title: added ? "Adicionado à sua carteira" : "Removido da sua carteira",
        description: codigo
          ? `${codigo} ${added ? "entrou na" : "saiu da"} sua Carteira TRIM.`
          : undefined,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Não foi possível atualizar a carteira",
        description: error?.message,
        variant: "destructive",
      });
    },
  });

  /** Montagem automática: adiciona de uma vez todos os ativos informados. */
  const addMany = useMutation({
    mutationFn: async (assetIds: string[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Faça login para montar sua carteira.");

      const novos = assetIds.filter((id) => id && !selectedIds.has(id));
      if (novos.length === 0) return { inserted: 0 };

      const { error } = await supabase
        .from("asset_favorites")
        .insert(novos.map((assetId) => ({ user_id: user.id, asset_id: assetId })));
      if (error) throw error;

      return { inserted: novos.length };
    },
    onSuccess: ({ inserted }) => {
      invalidate();
      toast({
        title: inserted > 0 ? "Carteira montada" : "Nenhuma novidade",
        description:
          inserted > 0
            ? `${inserted} ativo(s) adicionado(s) à sua carteira.`
            : "Todos esses ativos já estavam na sua carteira.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Não foi possível montar a carteira",
        description: error?.message,
        variant: "destructive",
      });
    },
  });

  return {
    selectedIds,
    isLoading,
    toggle,
    addMany,
    isSelected: (assetId: string) => selectedIds.has(assetId),
  };
};
