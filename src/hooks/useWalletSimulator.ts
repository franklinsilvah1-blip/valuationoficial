import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { calcularItem, calcularTotaisCarteira, CalculatedItem, WalletTotals } from "@/utils/walletCalculations";

export const useWalletSimulator = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Buscar carteira do usuário
  const { data: wallet, isLoading: loadingWallet, isError: walletError, error: walletErrorObj } = useQuery({
    queryKey: ["wallet-simulator"],
    retry: 2,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("wallet_simulator")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  // Buscar favoritos do usuário com dados dos ativos
  const { data: favorites, isLoading: loadingFavorites, isError: favoritesError, error: favoritesErrorObj } = useQuery({
    queryKey: ["favorites-for-wallet"],
    retry: 2,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Buscar apenas os IDs dos favoritos do usuário
      const { data: favoriteRows, error } = await supabase
        .from("asset_favorites")
        .select("asset_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const assetIds = (favoriteRows?.map((fav: any) => fav.asset_id) || []).filter(Boolean);
      if (assetIds.length === 0) return [];

      // Fonte: view assets_market_view (mesma usada em /app/mercado), que já
      // mascara (null) os 4 campos premium — tendencia, carteira,
      // recomendacao, nota_especialista — para quem não tem plano PRO+. Não
      // consulta mais a tabela crua asset_analyses (ver
      // supabase/migrations/20260415120000_plan_model_v2.sql).
      const { data: assetsData, error: assetsError } = await supabase
        .from("assets_market_view")
        .select("*")
        .in("id", assetIds);

      if (assetsError) throw assetsError;

      // Manter a ordem original dos favoritos
      const assetsById = new Map((assetsData ?? []).map((asset: any) => [asset.id, asset]));
      const orderedAssets = assetIds
        .map(id => assetsById.get(id))
        .filter(Boolean);

      return orderedAssets.map((asset: any) => ({
        id: asset.id,
        codigo_b3: asset.codigo_b3,
        nome: asset.nome,
        tipo: asset.tipo,
        setor: asset.setor,
        valor: asset.valor,
        roitrim: asset.roitrim,
        dy2025: asset.dy2025,
        roi2025: asset.roi2025,
        perfilInvestidor: asset.perfil_investidor,
        tendencia: asset.tendencia,
        taxaSemanal: asset.analysis_taxa_semanal,
        roi2026: asset.roi2026,
        roi2023a2025: asset.roi2023a2025,
        fatorMc: asset.fator_mc,
        carteira: asset.carteira,
        recomendacao: asset.recomendacao,
        nota: asset.nota_especialista,
        resumo: asset.resumo,
      }));
    },
  });

  // Buscar itens da carteira diretamente pelo user_id (desacoplado de favoritos)
  const { data: items, isLoading: loadingItems, isError: itemsError, error: itemsErrorObj } = useQuery({
    queryKey: ["wallet-items"],
    retry: 2,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Primeiro buscar a wallet do usuário
      const { data: walletData } = await supabase
        .from("wallet_simulator")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!walletData) return [];

      // Buscar itens da carteira
      const { data: walletItems, error } = await supabase
        .from("wallet_items")
        .select("*")
        .eq("wallet_id", walletData.id);

      if (error) throw error;
      if (!walletItems || walletItems.length === 0) return [];

      // Filtrar itens com asset_id null (ativo removido durante sync) e buscar asset_ids únicos
      const validItems = walletItems.filter(item => item.asset_id != null);
      if (validItems.length === 0) return [];
      const assetIds = [...new Set(validItems.map(item => item.asset_id))];

      // Buscar assets via assets_market_view (colunas achatadas, mesma fonte
      // gated usada em /app/mercado) — nenhum dos campos usados aqui
      // (valor, roitrim, dy2025, roi2025) é premium, mas a tabela crua
      // asset_analyses não é mais consultada diretamente por este hook.
      const { data: assetsData, error: assetsError } = await supabase
        .from("assets_market_view")
        .select("id, codigo_b3, nome, tipo, setor, valor, roitrim, dy2025, roi2025")
        .in("id", assetIds);

      if (assetsError) throw assetsError;

      // Criar mapa de assets
      const assetsMap = new Map((assetsData ?? []).map(asset => [asset.id, asset]));

      return validItems.map((item: any) => {
        const asset = assetsMap.get(item.asset_id);
        const precoAtual = Number(asset?.valor) || 0;

        return {
          ...item,
          codigo_b3: asset?.codigo_b3 || '',
          nome: asset?.nome || '',
          tipo: asset?.tipo || '',
          setor: asset?.setor || '',
          preco_atual: precoAtual,
          roitrim: Number(asset?.roitrim) || 0,
          dy2025: asset?.dy2025 ? Number(asset.dy2025) : undefined,
          roi2025: asset?.roi2025 ? Number(asset.roi2025) : undefined,
          proventos: item.proventos || 0,
        };
      });
    },
  });

  // Calcular itens simulados e totais
  // Calcular items simulados com logs detalhados
  const simulatedItems: CalculatedItem[] = items 
    ? items.map(item => {
        const total = items.reduce((sum, i) => 
          sum + (i.preco_compra * i.quantidade + (i.aporte_adicional || 0)), 0
        );
        const calculated = calcularItem(item, total);

        console.log('[WALLET-SIMULATED-ITEM]', {
          codigo: calculated.codigo_b3,
          roitrim: calculated.roitrim,
          preco_atual: calculated.preco_atual,
          valor_investido: calculated.valor_investido,
          roi_reais: calculated.roi_reais,
          resultado: calculated.valor_investido + calculated.roi_reais,
        });

        return calculated;
      })
    : [];

  const totals: WalletTotals | null = simulatedItems.length > 0
    ? calcularTotaisCarteira(simulatedItems)
    : null;

  // Criar carteira
  const createWallet = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("wallet_simulator")
        .insert({ user_id: user.id })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallet-simulator"] });
      toast({ title: "Carteira criada com sucesso!" });
    },
  });

  // Adicionar ou atualizar item
  const addOrUpdateItem = useMutation({
    mutationFn: async (item: {
      asset_id: string;
      quantidade: number;
      preco_compra: number;
      aporte_adicional?: number;
      proventos?: number;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Criar carteira se não existir
      let walletId = wallet?.id;
      if (!walletId) {
        const { data: newWallet, error: walletError } = await supabase
          .from("wallet_simulator")
          .insert({ user_id: user.id })
          .select()
          .single();

        if (walletError) throw walletError;
        walletId = newWallet.id;
      }

      // Verificar se item já existe
      const { data: existing } = await supabase
        .from("wallet_items")
        .select("id")
        .eq("wallet_id", walletId)
        .eq("asset_id", item.asset_id)
        .maybeSingle();

      if (existing) {
        // Atualizar existente
        const { error } = await supabase
          .from("wallet_items")
          .update({
            quantidade: item.quantidade,
            preco_compra: item.preco_compra,
            aporte_adicional: item.aporte_adicional || 0,
            proventos: item.proventos || 0,
          })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        // Inserir novo
        const { error } = await supabase
          .from("wallet_items")
          .insert({
            wallet_id: walletId,
            ...item,
            aporte_adicional: item.aporte_adicional || 0,
            proventos: item.proventos || 0,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallet-simulator"] });
      queryClient.invalidateQueries({ queryKey: ["wallet-items"] });
      toast({ title: "Dados salvos com sucesso!" });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao salvar dados",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Atualizar item
  const updateItem = useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: {
      id: string;
      quantidade?: number;
      preco_compra?: number;
      aporte_adicional?: number;
      data_compra?: string;
      proventos?: number;
    }) => {
      const { error } = await supabase
        .from("wallet_items")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallet-items"] });
      toast({ title: "Ativo atualizado!" });
    },
  });

  // Remover item
  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("wallet_items")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallet-items"] });
      toast({ title: "Ativo removido da carteira" });
    },
  });

  return {
    wallet,
    favorites: favorites || [],
    simulatedItems,
    totals,
    isLoading: loadingWallet || loadingFavorites || loadingItems,
    isError: walletError || favoritesError || itemsError,
    error: walletErrorObj || favoritesErrorObj || itemsErrorObj,
    createWallet,
    addOrUpdateItem,
    updateItem,
    removeItem,
  };
};
