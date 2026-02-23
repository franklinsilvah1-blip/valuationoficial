import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { calcularItem, calcularTotaisCarteira, CalculatedItem, WalletTotals } from "@/utils/walletCalculations";

export const useWalletSimulator = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Buscar carteira do usuário
  const { data: wallet, isLoading: loadingWallet } = useQuery({
    queryKey: ["wallet-simulator"],
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
  const { data: favorites, isLoading: loadingFavorites } = useQuery({
    queryKey: ["favorites-for-wallet"],
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

      // Buscar dados completos dos ativos com análises, igual à página Mercado
      const { data: assetsData, error: assetsError } = await supabase
        .from("assets")
        .select(`
          *,
          asset_analyses(*)
        `)
        .in("id", assetIds);

      if (assetsError) throw assetsError;

      // Manter a ordem original dos favoritos
      const assetsById = new Map(assetsData.map((asset: any) => [asset.id, asset]));
      const orderedAssets = assetIds
        .map(id => assetsById.get(id))
        .filter(Boolean);

      return orderedAssets.map((asset: any) => {
        const analysis = Array.isArray(asset.asset_analyses)
          ? asset.asset_analyses[0]
          : asset.asset_analyses || {};
        
        // Log de depuração detalhado, igual ao Mercado
        console.log('[WALLET-FAVORITE-RAW]', {
          codigo: asset.codigo_b3,
          has_asset_analyses: !!asset.asset_analyses,
          asset_analyses_length: asset.asset_analyses?.length,
          first_analysis: asset.asset_analyses?.[0],
          analysis_object: analysis,
        });

        return {
          id: asset.id,
          codigo_b3: asset.codigo_b3,
          nome: asset.nome,
          tipo: asset.tipo,
          setor: asset.setor,
          valor: analysis.valor,
          roitrim: analysis.roitrim,
          dy2025: analysis.dy2025,
          roi2025: analysis.roi2025,
          perfilInvestidor: analysis.perfil_investidor,
          tendencia: analysis.tendencia,
          taxaSemanal: analysis.taxa_semanal,
          roi2026: analysis.roi2026,
          roi2023a2025: analysis.roi2023a2025,
          fatorMc: analysis.fator_mc,
          carteira: analysis.carteira,
          recomendacao: analysis.recomendacao,
          nota: analysis.nota_especialista,
          resumo: analysis.resumo,
        };
      });
    },
  });

  // Buscar itens da carteira diretamente pelo user_id (desacoplado de favoritos)
  const { data: items, isLoading: loadingItems } = useQuery({
    queryKey: ["wallet-items"],
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

      // Buscar assets com suas análises separadamente
      const { data: assetsData, error: assetsError } = await supabase
        .from("assets")
        .select(`
          id,
          codigo_b3,
          nome,
          tipo,
          setor,
          asset_analyses(
            valor,
            roitrim,
            dy2025,
            roi2025
          )
        `)
        .in("id", assetIds);

      if (assetsError) throw assetsError;

      // Criar mapa de assets
      const assetsMap = new Map(assetsData?.map(asset => [asset.id, asset]) || []);

      return validItems.map((item: any) => {
        const asset = assetsMap.get(item.asset_id);
        
        // Tratar asset_analyses como array OU objeto único
        const analyses = asset?.asset_analyses;
        const assetAnalysis = Array.isArray(analyses) 
          ? analyses[0] 
          : analyses;
        
        const precoAtual = assetAnalysis?.valor || 0;
        
        console.log('[WALLET-ITEM-LOAD]', {
          codigo: asset?.codigo_b3,
          asset_analyses_type: Array.isArray(analyses) ? 'array' : typeof analyses,
          asset_analyses: analyses,
          preco_atual_resolved: precoAtual,
        });

        return {
          ...item,
          codigo_b3: asset?.codigo_b3 || '',
          nome: asset?.nome || '',
          tipo: asset?.tipo || '',
          setor: asset?.setor || '',
          preco_atual: precoAtual,
          roitrim: assetAnalysis?.roitrim || 0,
          dy2025: assetAnalysis?.dy2025,
          roi2025: assetAnalysis?.roi2025,
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
    createWallet,
    addOrUpdateItem,
    updateItem,
    removeItem,
  };
};
