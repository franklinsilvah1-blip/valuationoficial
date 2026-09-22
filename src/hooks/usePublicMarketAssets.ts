import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PublicMarketAsset {
  id: string;
  codigo_b3: string;
  tipo: string | null;
  roi2026: string | null;
  /** NULL quando o usuário não tem direito — mascarado no Postgres, não aqui. */
  recomendacao: string | null;
  /** Compatível com AssetsTableRow, que indexa colunas por chave. */
  [key: string]: unknown;
}

/**
 * Lista pública de ativos — ÚNICA porta de entrada do conteúdo de mercado para
 * quem não está autenticado.
 *
 * Tanto a HOME ("Melhores ativos do ano") quanto /mercado consomem daqui, de
 * modo que existe uma só definição de "20 ativos com maior ROI 2026" — ela
 * mora no banco, em `get_top_assets_year()`, e é invocada por
 * `get_public_market_assets()` quando não há termo de busca. Nenhum dos dois
 * lados reimplementa o ranking no frontend, então não há como divergirem.
 *
 * A RPC devolve no máximo 4 colunas e no máximo 20 linhas (10 em busca
 * parcial); o cliente não controla limit/offset/ordem.
 */
export const usePublicMarketAssets = (search?: string) => {
  const term = search?.trim() ?? "";

  return useQuery({
    queryKey: ["public-market-assets", term],
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    queryFn: async (): Promise<PublicMarketAsset[]> => {
      const { data, error } = await supabase.rpc("get_public_market_assets", {
        p_search: term || null,
      });
      if (error) throw error;
      return (data ?? []) as PublicMarketAsset[];
    },
  });
};

/** Atalho semântico para a seção "Melhores ativos do ano" da home. */
export const useTopAssetsOfYear = () => usePublicMarketAssets("");
