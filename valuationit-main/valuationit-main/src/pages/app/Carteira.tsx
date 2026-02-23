
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Save, Trash2, Star, Briefcase, CheckCircle, Clock, Wallet, TrendingUp, PiggyBank, Coins } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useWalletSimulator } from "@/hooks/useWalletSimulator";
import { formatCurrency } from "@/utils/formatters";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AssetCard from "@/components/AssetCard";

import { calcularItemReal, calcularTotaisCarteiraReal, type CalculatedItemReal } from "@/utils/walletCalculations";
import { useState, useMemo } from "react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
  ComposedChart, Line, LabelList
} from "recharts";

const COLORS = ['#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#ec4899', '#14b8a6', '#f97316'];

const Carteira = () => {
  const { favorites, simulatedItems, totals, isLoading, addOrUpdateItem, removeItem } = useWalletSimulator();
  const { user, userPlan } = useAuth();
  
  // Criar Set de IDs dos favoritos para mostrar indicador visual
  const favoriteAssetIds = new Set(favorites.map(f => f.id));
  
  // Criar Set de IDs dos itens já simulados
  const simulatedAssetIds = new Set(simulatedItems.map(item => item.asset_id));
  
  // Favoritos que ainda NÃO têm simulação (precisam aparecer na tabela para preenchimento)
  const favoritesWithoutSimulation = favorites.filter(f => !simulatedAssetIds.has(f.id));
  
  // CORREÇÃO: Mostrar TODOS os wallet_items, independente de favoritos
  // Isso garante que os dados não "somem" quando o usuário remove um favorito
  const simulatedItemsReal: CalculatedItemReal[] = simulatedItems.length > 0
    ? simulatedItems.map(item => {
        const total = simulatedItems.reduce((sum, i) => sum + i.valor_investido, 0);
        return calcularItemReal(item, total);
      })
    : [];
  
  const totalsReal = calcularTotaisCarteiraReal(simulatedItemsReal);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [formDataMap, setFormDataMap] = useState<Record<string, any>>({});

  const getFormData = (assetId: string) => {
    return formDataMap[assetId] || { quantidade: 0, preco_compra: 0, proventos: 0 };
  };

  const updateFormData = (assetId: string, updates: any) => {
    setFormDataMap(prev => ({
      ...prev,
      [assetId]: { ...prev[assetId], ...updates }
    }));
  };

  const handleSaveSimulation = async (assetId: string) => {
    const formData = getFormData(assetId);
    if (!formData.preco_compra || !formData.quantidade) {
      toast({
        title: "Erro",
        description: "Preencha preço e quantidade",
        variant: "destructive"
      });
      return;
    }

    try {
      await addOrUpdateItem.mutateAsync({
        asset_id: assetId,
        preco_compra: formData.preco_compra,
        quantidade: formData.quantidade,
        aporte_adicional: 0,
        proventos: formData.proventos || 0
      });
      
      setEditingItem(null);
      setFormDataMap(prev => {
        const newMap = { ...prev };
        delete newMap[assetId];
        return newMap;
      });

      toast({
        title: "Sucesso",
        description: "Simulação salva com sucesso"
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao salvar simulação",
        variant: "destructive"
      });
    }
  };

  const handleRemoveSimulation = async (walletItemId: string) => {
    try {
      await removeItem.mutateAsync(walletItemId);
      toast({
        title: "Sucesso",
        description: "Item removido da carteira"
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao remover item",
        variant: "destructive"
      });
    }
  };

  const handleRemoveFromWallet = async (assetId: string) => {
    if (!user) return;
    
    try {
      const { error: favoriteError } = await supabase
        .from("asset_favorites")
        .delete()
        .eq("user_id", user.id)
        .eq("asset_id", assetId);

      if (favoriteError) throw favoriteError;

      const simulatedItem = simulatedItems.find(item => item.asset_id === assetId);
      if (simulatedItem) {
        await removeItem.mutateAsync(simulatedItem.id);
      }

      // FIX: Limpar estado local do formulário para o item removido
      setFormDataMap(prev => {
        const newMap = { ...prev };
        delete newMap[assetId];
        return newMap;
      });
      
      // Limpar editingItem se for o mesmo
      if (editingItem === assetId) {
        setEditingItem(null);
      }

      queryClient.invalidateQueries({ queryKey: ["favorites-for-wallet"] });
      queryClient.invalidateQueries({ queryKey: ["wallet-items"] });
      
      toast({
        title: "Sucesso",
        description: "Ativo removido da carteira"
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao remover ativo",
        variant: "destructive"
      });
    }
  };

  const getRoiColor = (roi: number) => {
    if (roi >= 10) return "bg-green-700 text-white";
    if (roi >= 5) return "bg-green-600 text-white";
    if (roi > 0) return "bg-green-500 text-white";
    if (roi === 0) return "bg-gray-400 text-white";
    if (roi > -5) return "bg-red-500 text-white";
    if (roi > -10) return "bg-red-600 text-white";
    return "bg-red-700 text-white";
  };

  // Agrupar dados por tipo de ativo para o gráfico de evolução
  const groupedByType = useMemo(() => {
    const groups: Record<string, { 
      valorInvestido: number; 
      roiProventos: number; 
      roiPercentual: number;
    }> = {};
    
    simulatedItemsReal.forEach(item => {
      const tipo = item.tipo || 'OUTROS';
      if (!groups[tipo]) {
        groups[tipo] = { valorInvestido: 0, roiProventos: 0, roiPercentual: 0 };
      }
      groups[tipo].valorInvestido += item.valor_investido;
      groups[tipo].roiProventos += item.roi_com_proventos_reais;
    });
    
    // Calcular ROI % por grupo
    Object.keys(groups).forEach(tipo => {
      const group = groups[tipo];
      group.roiPercentual = group.valorInvestido > 0 
        ? (group.roiProventos / group.valorInvestido) * 100 
        : 0;
    });
    
    // Ordenar tipos pela ordem desejada
    const tipoOrder = ['ACAO', 'BDR', 'FII', 'RFIXA', 'ETF', 'CRIPTO', 'INDICE', 'OUTROS'];
    
    return tipoOrder
      .filter(tipo => groups[tipo])
      .map(tipo => ({
        tipo: tipo === 'RFIXA' ? 'RENDA FIXA' : tipo,
        "VALOR INVESTIDO": groups[tipo].valorInvestido,
        "ROI + PROVENTOS": groups[tipo].roiProventos,
        "ROI (%)": Number(groups[tipo].roiPercentual.toFixed(2))
      }));
  }, [simulatedItemsReal]);

  // Agrupar dados por SETOR para o gráfico de pizza
  const pieDataBySetor = useMemo(() => {
    const groups: Record<string, number> = {};
    
    simulatedItemsReal.forEach(item => {
      const setor = item.setor || 'OUTROS';
      if (!groups[setor]) {
        groups[setor] = 0;
      }
      groups[setor] += item.valor_investido;
    });
    
    const totalInvestido = Object.values(groups).reduce((sum, val) => sum + val, 0);
    
    return Object.entries(groups)
      .map(([setor, valor], index) => ({
        name: setor,
        value: totalInvestido > 0 ? Number(((valor / totalInvestido) * 100).toFixed(2)) : 0,
        color: COLORS[index % COLORS.length]
      }))
      .sort((a, b) => b.value - a.value);
  }, [simulatedItemsReal]);

  if (isLoading) {
    return (
      <AppLayout title="Minha Carteira">
        <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/4"></div>
            <div className="h-64 bg-muted rounded"></div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Minha Carteira">
      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
        {simulatedItemsReal.length === 0 && favorites.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-muted-foreground mb-4">
                Você ainda não tem ativos na carteira
              </p>
              <Button asChild>
                <a href="/app/mercado">Explorar Mercado</a>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            {/* 0. MINI-CARDS RESUMO NO TOPO */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-3">
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-2 sm:p-3 flex flex-col items-center justify-center gap-1">
                  <Briefcase className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Total Ativos</p>
                  <p className="text-lg sm:text-xl font-bold text-primary">{favorites.length}</p>
                </CardContent>
              </Card>
              <Card className="bg-amber-500/10 border-amber-500/20">
                <CardContent className="p-2 sm:p-3 flex flex-col items-center justify-center gap-1">
                  <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600 dark:text-amber-400" />
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Pendentes</p>
                  <p className="text-lg sm:text-xl font-bold text-amber-600 dark:text-amber-400">{favoritesWithoutSimulation.length}</p>
                </CardContent>
              </Card>
              <Card className="bg-blue-500/10 border-blue-500/20">
                <CardContent className="p-2 sm:p-3 flex flex-col items-center justify-center gap-1">
                  <Wallet className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400" />
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Investido</p>
                  <p className="text-sm sm:text-lg font-bold text-blue-600 dark:text-blue-400">
                    {formatCurrency(totalsReal.total_investido)}
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-teal-500/10 border-teal-500/20">
                <CardContent className="p-2 sm:p-3 flex flex-col items-center justify-center gap-1">
                  <Coins className="h-4 w-4 sm:h-5 sm:w-5 text-teal-600 dark:text-teal-400" />
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Proventos</p>
                  <p className="text-sm sm:text-lg font-bold text-teal-600 dark:text-teal-400">
                    {formatCurrency(totalsReal.proventos_total)}
                  </p>
                </CardContent>
              </Card>
              <Card className={totalsReal.roi_com_proventos_reais >= 0 ? "bg-purple-500/10 border-purple-500/20" : "bg-red-500/10 border-red-500/20"}>
                <CardContent className="p-2 sm:p-3 flex flex-col items-center justify-center gap-1">
                  <PiggyBank className={`h-4 w-4 sm:h-5 sm:w-5 ${totalsReal.roi_com_proventos_reais >= 0 ? 'text-purple-600 dark:text-purple-400' : 'text-red-600 dark:text-red-400'}`} />
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Acumulado</p>
                  <p className={`text-sm sm:text-lg font-bold ${totalsReal.roi_com_proventos_reais >= 0 ? 'text-purple-600 dark:text-purple-400' : 'text-red-600 dark:text-red-400'}`}>
                    {formatCurrency(totalsReal.total_investido + totalsReal.roi_com_proventos_reais)}
                  </p>
                </CardContent>
              </Card>
              <Card className={totalsReal.roi_com_proventos_percentual >= 0 ? "bg-emerald-500/10 border-emerald-500/20" : "bg-red-500/10 border-red-500/20"}>
                <CardContent className="p-2 sm:p-3 flex flex-col items-center justify-center gap-1">
                  <TrendingUp className={`h-4 w-4 sm:h-5 sm:w-5 ${totalsReal.roi_com_proventos_percentual >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`} />
                  <p className="text-[10px] sm:text-xs text-muted-foreground">ROI Geral</p>
                  <p className={`text-sm sm:text-lg font-bold ${totalsReal.roi_com_proventos_percentual >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    {totalsReal.roi_com_proventos_percentual.toFixed(2)}%
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* 1. TABELA - Simulador de Carteira (PRIMEIRO) */}
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-lg sm:text-2xl">📊 Simulador de Ganho Real</CardTitle>
                  <Badge variant="secondary" className="text-xs sm:text-sm">
                    {favorites.length} {favorites.length === 1 ? 'ativo' : 'ativos'}
                  </Badge>
                </div>
                <CardDescription className="text-xs sm:text-sm">
                  Acompanhe o desempenho real dos seus investimentos
                  {favoritesWithoutSimulation.length > 0 && (
                    <span className="text-amber-600 dark:text-amber-400 ml-1">
                      • {favoritesWithoutSimulation.length} pendente{favoritesWithoutSimulation.length > 1 ? 's' : ''} de simulação
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0">
                <div className="space-y-4">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="bg-muted">
                          <th className="border border-border p-2 text-center font-bold" title="Favorito">⭐</th>
                          <th className="border border-border p-2 text-left font-bold">CÓDIGO</th>
                          <th className="border border-border p-2 text-left font-bold">TIPO</th>
                          <th className="border border-border p-2 text-left font-bold">SETOR</th>
                          <th className="border border-border p-2 text-right font-bold bg-amber-600 text-white">PREÇO<br/>COMPRA</th>
                          <th className="border border-border p-2 text-right font-bold bg-sky-600 text-white">QTDE<br/>AÇÕES</th>
                          <th className="border border-border p-2 text-right font-bold bg-teal-600 text-white">PROVENTOS<br/>POR AÇÃO</th>
                          <th className="border border-border p-2 text-right font-bold bg-amber-500 text-white">VALOR<br/>INVESTIDO</th>
                          <th className="border border-border p-2 text-right font-bold bg-teal-500 text-white">GANHOS<br/>PROVENTOS</th>
                          <th className="border border-border p-2 text-right font-bold bg-purple-600 text-white">VALOR ATUAL<br/>/ VENDA</th>
                          <th className="border border-border p-2 text-right font-bold">ROI (%)</th>
                          <th className="border border-border p-2 text-right font-bold bg-green-700 text-white">ROI (R$)</th>
                          <th className="border border-border p-2 text-right font-bold">RESULTADO</th>
                          <th className="border border-border p-2 text-center font-bold">AÇÕES</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* 1. Mostrar favoritos SEM simulação (para preenchimento) */}
                        {favoritesWithoutSimulation.map((favorite) => {
                          const formData = getFormData(favorite.id);
                          const hasFormData = formData.preco_compra > 0 || formData.quantidade > 0;

                          return (
                            <tr key={`fav-${favorite.id}`} className="hover:bg-muted/50 bg-yellow-50/30 dark:bg-yellow-900/10">
                              <td className="border border-border p-2 text-center">
                                <Star className="h-4 w-4 text-yellow-500 fill-yellow-500 inline" />
                              </td>
                              <td className="border border-border p-2 font-medium">{favorite.codigo_b3}</td>
                              <td className="border border-border p-2">{favorite.tipo}</td>
                              <td className="border border-border p-2">{favorite.setor || '-'}</td>
                              <td className="border border-border p-2 text-right bg-amber-600/20">
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="0.00"
                                  value={formData.preco_compra || ''}
                                  onChange={(e) => {
                                    setEditingItem(favorite.id);
                                    updateFormData(favorite.id, { 
                                      preco_compra: Number(e.target.value), 
                                      quantidade: formData.quantidade || 0,
                                      proventos: formData.proventos || 0
                                    });
                                  }}
                                  className="w-24 text-right"
                                />
                              </td>
                              <td className="border border-border p-2 text-right bg-sky-600/20">
                                <Input
                                  type="number"
                                  placeholder="0"
                                  value={formData.quantidade || ''}
                                  onChange={(e) => {
                                    setEditingItem(favorite.id);
                                    updateFormData(favorite.id, { 
                                      quantidade: Number(e.target.value), 
                                      preco_compra: formData.preco_compra || 0,
                                      proventos: formData.proventos || 0
                                    });
                                  }}
                                  className="w-20 text-right"
                                />
                              </td>
                              <td className="border border-border p-2 text-right bg-teal-600/20">
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="0.00"
                                  value={formData.proventos || ''}
                                  onChange={(e) => {
                                    setEditingItem(favorite.id);
                                    updateFormData(favorite.id, { 
                                      proventos: Number(e.target.value),
                                      preco_compra: formData.preco_compra || 0,
                                      quantidade: formData.quantidade || 0
                                    });
                                  }}
                                  className="w-20 text-right"
                                />
                              </td>
                              <td className="border border-border p-2 text-right bg-amber-500/20 text-muted-foreground">-</td>
                              <td className="border border-border p-2 text-right bg-teal-500/20 text-muted-foreground">-</td>
                              <td className="border border-border p-2 text-right bg-purple-600/20 text-muted-foreground">-</td>
                              <td className="border border-border p-2 text-right text-muted-foreground">-</td>
                              <td className="border border-border p-2 text-right text-muted-foreground">-</td>
                              <td className="border border-border p-2 text-right text-muted-foreground">-</td>
                              <td className="border border-border p-2 text-center">
                                <div className="flex gap-1 justify-center">
                                  <Button
                                    size="sm"
                                    variant="default"
                                    onClick={() => handleSaveSimulation(favorite.id)}
                                    className="bg-green-600 hover:bg-green-700"
                                    disabled={!hasFormData}
                                  >
                                    <Save className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => handleRemoveFromWallet(favorite.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}

                        {/* 2. Mostrar itens JÁ simulados (wallet_items) */}
                        {simulatedItemsReal.map((simulatedItem) => {
                          const isFavorite = favoriteAssetIds.has(simulatedItem.asset_id);
                          const formData = getFormData(simulatedItem.asset_id);

                          return (
                            <tr key={simulatedItem.id} className="hover:bg-muted/50">
                              <td className="border border-border p-2 text-center">
                                {isFavorite ? (
                                  <Star className="h-4 w-4 text-yellow-500 fill-yellow-500 inline" />
                                ) : (
                                  <Star className="h-4 w-4 text-muted-foreground inline" />
                                )}
                              </td>
                              <td className="border border-border p-2 font-medium">{simulatedItem.codigo_b3}</td>
                              <td className="border border-border p-2">{simulatedItem.tipo}</td>
                              <td className="border border-border p-2">{simulatedItem.setor}</td>
                              <td className="border border-border p-2 text-right bg-amber-600/20">
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={editingItem === simulatedItem.asset_id ? formData.preco_compra || simulatedItem.preco_compra : simulatedItem.preco_compra}
                                  onChange={(e) => {
                                    setEditingItem(simulatedItem.asset_id);
                                    updateFormData(simulatedItem.asset_id, { 
                                      preco_compra: Number(e.target.value), 
                                      quantidade: simulatedItem.quantidade,
                                      proventos: simulatedItem.proventos || 0
                                    });
                                  }}
                                  className="w-24 text-right"
                                />
                              </td>
                              <td className="border border-border p-2 text-right bg-sky-600/20">
                                <Input
                                  type="number"
                                  value={editingItem === simulatedItem.asset_id ? formData.quantidade || simulatedItem.quantidade : simulatedItem.quantidade}
                                  onChange={(e) => {
                                    setEditingItem(simulatedItem.asset_id);
                                    updateFormData(simulatedItem.asset_id, { 
                                      quantidade: Number(e.target.value), 
                                      preco_compra: simulatedItem.preco_compra,
                                      proventos: simulatedItem.proventos || 0
                                    });
                                  }}
                                  className="w-20 text-right"
                                />
                              </td>
                              <td className="border border-border p-2 text-right bg-teal-600/20">
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={editingItem === simulatedItem.asset_id ? (formData.proventos ?? simulatedItem.proventos ?? 0) : (simulatedItem.proventos || 0)}
                                  onChange={(e) => {
                                    setEditingItem(simulatedItem.asset_id);
                                    updateFormData(simulatedItem.asset_id, { 
                                      proventos: Number(e.target.value),
                                      preco_compra: simulatedItem.preco_compra,
                                      quantidade: simulatedItem.quantidade
                                    });
                                  }}
                                  className="w-20 text-right"
                                />
                              </td>
                              <td className="border border-border p-2 text-right bg-amber-500/20 font-semibold">
                                {formatCurrency(simulatedItem.valor_investido)}
                              </td>
                              <td className="border border-border p-2 text-right bg-teal-500/20 font-semibold">
                                {formatCurrency(simulatedItem.proventos_totais)}
                              </td>
                              <td className="border border-border p-2 text-right bg-purple-600/20">
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={editingItem === simulatedItem.asset_id ? (formData.valor_venda ?? simulatedItem.preco_atual ?? 0) : (simulatedItem.preco_atual || 0)}
                                  onChange={(e) => {
                                    setEditingItem(simulatedItem.asset_id);
                                    updateFormData(simulatedItem.asset_id, { 
                                      valor_venda: Number(e.target.value),
                                      preco_compra: simulatedItem.preco_compra,
                                      quantidade: simulatedItem.quantidade,
                                      proventos: simulatedItem.proventos || 0
                                    });
                                  }}
                                  className="w-24 text-right"
                                />
                              </td>
                              <td className={`border border-border p-2 text-right font-bold ${getRoiColor(simulatedItem.roi_com_proventos_percentual)}`}>
                                {simulatedItem.roi_com_proventos_percentual.toFixed(2)}%
                              </td>
                              <td className={`border border-border p-2 text-right font-bold ${getRoiColor(simulatedItem.roi_com_proventos_percentual)}`}>
                                {formatCurrency(simulatedItem.roi_com_proventos_reais)}
                              </td>
                              <td className="border border-border p-2 text-right font-semibold">
                                {formatCurrency(simulatedItem.resultado_com_proventos)}
                              </td>
                              <td className="border border-border p-2 text-center">
                                <div className="flex gap-1 justify-center">
                                  <Button
                                    size="sm"
                                    variant="default"
                                    onClick={() => handleSaveSimulation(simulatedItem.asset_id)}
                                    className="bg-green-600 hover:bg-green-700"
                                  >
                                    <Save className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => handleRemoveSimulation(simulatedItem.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}

                        {/* Linha de Totais Ganho Real */}
                        {simulatedItemsReal.length > 0 && (
                          <tr className="bg-primary/10 font-bold">
                            <td colSpan={7} className="border border-border p-2 text-right">TOTAIS:</td>
                            <td className="border border-border p-2 text-right bg-amber-500/20">
                              {formatCurrency(totalsReal.total_investido)}
                            </td>
                            <td className="border border-border p-2 text-right bg-teal-500/20">
                              {formatCurrency(totalsReal.proventos_total)}
                            </td>
                            <td className="border border-border p-2 text-right bg-purple-600/20">-</td>
                            <td className={`border border-border p-2 text-right ${getRoiColor(totalsReal.roi_com_proventos_percentual)}`}>
                              {totalsReal.roi_com_proventos_percentual.toFixed(2)}%
                            </td>
                            <td className={`border border-border p-2 text-right ${getRoiColor(totalsReal.roi_com_proventos_percentual)}`}>
                              {formatCurrency(totalsReal.roi_com_proventos_reais)}
                            </td>
                            <td className="border border-border p-2 text-right">
                              {formatCurrency(totalsReal.resultado_com_proventos_total)}
                            </td>
                            <td className="border border-border p-2"></td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 2. GRÁFICOS - Evolução e Perfil da Carteira (SEGUNDO) */}
            {simulatedItemsReal.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Gráfico Combinado - Evolução da Carteira por Tipo */}
                <Card>
                  <CardHeader className="p-4 sm:p-6">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <CardTitle className="text-lg sm:text-2xl">📈 Evolução da Carteira</CardTitle>
                      <Badge variant="secondary" className="text-xs sm:text-sm">
                        {simulatedItemsReal.length} {simulatedItemsReal.length === 1 ? 'ativo' : 'ativos'}
                      </Badge>
                    </div>
                    <CardDescription className="text-xs sm:text-sm">
                      Comparação por tipo de ativo: valor investido, ROI e percentual
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6 pt-0">
                    <div className="h-[280px] sm:h-[350px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                          data={groupedByType}
                          margin={{ top: 20, right: 50, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="tipo" />
                          
                          {/* Eixo Y esquerdo - Valores em R$ */}
                          <YAxis 
                            yAxisId="left"
                            tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                          />
                          
                          {/* Eixo Y direito - Percentual */}
                          <YAxis 
                            yAxisId="right" 
                            orientation="right"
                            tickFormatter={(value) => `${value}%`}
                            domain={[0, 'auto']}
                          />
                          
                          <Tooltip 
                            formatter={(value: number, name: string) => {
                              if (name === 'ROI (%)') return `${value.toFixed(2)}%`;
                              return formatCurrency(value);
                            }}
                            contentStyle={{ 
                              backgroundColor: 'hsl(var(--background))', 
                              border: '1px solid hsl(var(--border))' 
                            }}
                          />
                          <Legend />
                          
                          {/* Barra Valor Investido - Azul */}
                          <Bar 
                            yAxisId="left"
                            dataKey="VALOR INVESTIDO" 
                            fill="#3b82f6"
                            isAnimationActive={true}
                            animationDuration={800}
                          />
                          
                          {/* Barra ROI + Proventos - Amarelo */}
                          <Bar 
                            yAxisId="left"
                            dataKey="ROI + PROVENTOS" 
                            fill="#f59e0b"
                            isAnimationActive={true}
                            animationDuration={800}
                            animationBegin={200}
                          />
                          
                          {/* Linha com pontos ROI % - Laranja */}
                          <Line 
                            yAxisId="right"
                            type="monotone"
                            dataKey="ROI (%)"
                            stroke="#f97316"
                            strokeWidth={2}
                            dot={{ fill: '#f97316', strokeWidth: 2, r: 6 }}
                          >
                            <LabelList 
                              dataKey="ROI (%)" 
                              position="top" 
                              formatter={(value: number) => `${value.toFixed(2)}%`}
                              style={{ fontSize: '11px', fill: '#f97316', fontWeight: 'bold' }}
                            />
                          </Line>
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                    
                    {/* Resumo do Total, Resultado e ROI */}
                    <div className="mt-4 pt-4 border-t border-border">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                        <div className="sm:text-left pb-4 sm:pb-0 border-b sm:border-b-0 border-border">
                          <p className="text-sm text-muted-foreground">Total Investido</p>
                          <p className="text-xl font-bold">{formatCurrency(totalsReal.total_investido)}</p>
                        </div>
                        <div className="pb-4 sm:pb-0 border-b sm:border-b-0 border-border sm:border-x sm:px-4">
                          <p className="text-sm text-muted-foreground">Total Acumulado</p>
                          <p className={`text-xl font-bold ${totalsReal.roi_com_proventos_reais >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(totalsReal.total_investido + totalsReal.roi_com_proventos_reais)}
                          </p>
                        </div>
                        <div className="sm:text-right">
                          <p className="text-sm text-muted-foreground">ROI da CARTEIRA</p>
                          <p className={`text-xl font-bold ${totalsReal.roi_com_proventos_percentual >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {totalsReal.roi_com_proventos_percentual.toFixed(2)}%
                          </p>
                          <p className={`text-sm ${totalsReal.roi_com_proventos_reais >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(totalsReal.roi_com_proventos_reais)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Gráfico de Pizza - Perfil da Carteira */}
                <Card>
                  <CardHeader className="p-4 sm:p-6">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <CardTitle className="text-lg sm:text-2xl">🥧 Perfil da Carteira</CardTitle>
                      <Badge variant="secondary" className="text-xs sm:text-sm">
                        {pieDataBySetor.length} {pieDataBySetor.length === 1 ? 'setor' : 'setores'}
                      </Badge>
                    </div>
                    <CardDescription className="text-xs sm:text-sm">
                      Distribuição percentual por setor
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6 pt-0">
                    <div className="h-[300px] sm:h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieDataBySetor}
                          cx="50%"
                          cy="45%"
                          labelLine={true}
                          label={({ name, value, cx, cy, midAngle, outerRadius }) => {
                            const RADIAN = Math.PI / 180;
                            const radius = outerRadius + 25;
                            const x = cx + radius * Math.cos(-midAngle * RADIAN);
                            const y = cy + radius * Math.sin(-midAngle * RADIAN);
                            const textAnchor = x > cx ? 'start' : 'end';
                            
                            return (
                              <text 
                                x={x} 
                                y={y} 
                                fill="currentColor"
                                textAnchor={textAnchor}
                                dominantBaseline="central"
                                fontSize={11}
                              >
                                {`${name}: ${value.toFixed(1)}%`}
                              </text>
                            );
                          }}
                          outerRadius={90}
                          innerRadius={0}
                          fill="#8884d8"
                          dataKey="value"
                          paddingAngle={1}
                        >
                          {pieDataBySetor.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value: number, name: string) => [`${value.toFixed(2)}%`, name]}
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--background))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                            padding: '8px 12px'
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* 3. CARDS - Lista de Ativos Favoritos (TERCEIRO) */}
            <div>
              <h2 className="text-lg sm:text-2xl font-semibold mb-4">⭐ Meus Ativos Favoritos</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {favorites.map((asset) => {
                  const currentUserPlan = userPlan || "FREE";
                  
                  return (
                    <AssetCard
                      key={asset.id}
                      assetId={asset.id}
                      codigo={asset.codigo_b3}
                      nome={asset.nome}
                      tipo={asset.tipo}
                      setor={asset.setor}
                      perfilInvestidor={asset.perfilInvestidor}
                      recomendacao={asset.recomendacao}
                      tendencia={asset.tendencia}
                      taxaSemanal={asset.taxaSemanal}
                      carteira={asset.carteira}
                      nota={asset.nota}
                      notaEspecialista={asset.nota}
                      resumo={asset.resumo}
                      valor={asset.valor}
                      roi2026={asset.roi2026}
                      roi2023a2025={asset.roi2023a2025}
                      roitrim={asset.roitrim}
                      roi2025={asset.roi2025}
                      dy2025={asset.dy2025}
                      fatorMc={asset.fatorMc}
                      userPlan={currentUserPlan}
                      hideAddToCartButton
                      showRemoveButton
                      onRemoveFromWallet={handleRemoveFromWallet}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Carteira;
